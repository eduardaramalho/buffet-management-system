process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/buffet_test';
process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.CORS_ORIGIN = 'http://localhost:5173';

import { describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { AuthController } from './modules/auth/presentation/controllers/AuthController.js';
import { createRateLimitTestApp } from './app.js';
import app from './app.js';

describe('API security middleware', () => {
  it('includes Helmet security headers in API responses', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-dns-prefetch-control']).toBe('off');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('keeps the response working and returns a request id with access logs enabled', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('exposes Prometheus metrics without authentication', async () => {
    await request(app).get('/api/v1/health');

    const response = await request(app).get('/api/v1/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('process_cpu_user_seconds_total');
    expect(response.text).toContain('http_requests_total');
    expect(response.text).toContain('http_request_duration_seconds');
    expect(response.text).toContain('route="/api/v1/health"');
    expect(response.text).toContain('status_code="200"');
  });

  it('blocks a disallowed CORS origin', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://malicious.example');

    expect([204, 403]).toContain(response.status);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate-limits repeated login attempts', async () => {
    const attempts = 6;
    let blocked = false;
    const fakeService = { login: async () => ({ accessToken: 'token', refreshToken: 'refresh', user: { id: 'user-1', name: 'User', email: 'user@example.com' } }) };
    const testApp = createRateLimitTestApp(new AuthController(fakeService as any));

    for (let index = 0; index < attempts; index += 1) {
      const response = await request(testApp)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:5173')
        .send({ email: 'user@example.com', password: 'wrong-password' });

      if (response.status === 429) {
        blocked = true;
        break;
      }
    }

    expect(blocked).toBe(true);
  });

  it('requires authentication on user, role, and current-user endpoints', async () => {
    const protectedEndpoints = [
      ['/api/v1/auth/me', 'get'],
      ['/api/v1/users', 'get'],
      ['/api/v1/roles', 'get']
    ] as const;

    for (const [endpoint, method] of protectedEndpoints) {
      const response = await request(app)[method](endpoint);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Não autenticado' });
    }
  });
});
