import { describe, expect, it } from '@jest/globals';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

import { httpMetricsMiddleware, metricsRegistry } from './metrics.js';

const buildApp = () => {
  const app = express();
  app.use(httpMetricsMiddleware);

  const protectedRouter = express.Router();
  protectedRouter.use((_request: Request, response: Response) => {
    response.status(401).json({ message: 'Não autenticado' });
  });
  protectedRouter.get('/secret', (_request, response) => {
    response.json({ ok: true });
  });

  const eventsRouter = express.Router();
  eventsRouter.get('/', (_request, response) => {
    response.json([]);
  });
  eventsRouter.get('/:id', (_request, response) => {
    response.json({ id: 'any' });
  });

  app.get('/metrics-test/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.get(['/metrics-test/status', '/metrics-test/ping'], (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/metrics-test/protected', protectedRouter);
  app.use('/metrics-test/events', eventsRouter);
  app.use((_request: Request, response: Response) => {
    response.status(404).json({ message: 'Rota não encontrada' });
  });
  app.use((_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    response.status(500).json({ message: 'Erro interno' });
  });

  return app;
};

const routeLabelsFor = async (statusCode: string): Promise<string[]> => {
  const metric = await metricsRegistry.getSingleMetric('http_requests_total')?.get();
  return (metric?.values ?? [])
    .filter((value) => value.labels.status_code === statusCode)
    .map((value) => String(value.labels.route));
};

describe('httpMetricsMiddleware', () => {
  const app = buildApp();

  it('labels a matched route with its pattern', async () => {
    await request(app).get('/metrics-test/health').expect(200);

    expect(await routeLabelsFor('200')).toContain('/metrics-test/health');
  });

  it('labels a route with parameters with the pattern instead of the concrete URL', async () => {
    await request(app).get('/metrics-test/events/abc-123').expect(200);
    await request(app).get('/metrics-test/events/xyz-789').expect(200);

    const routes = await routeLabelsFor('200');
    expect(routes).toContain('/metrics-test/events/:id');
    expect(routes).not.toContain('/metrics-test/events/abc-123');
    expect(routes).not.toContain('/metrics-test/events/xyz-789');
  });

  it('labels the router root route with the mount path', async () => {
    await request(app).get('/metrics-test/events').expect(200);

    expect(await routeLabelsFor('200')).toContain('/metrics-test/events/');
  });

  it('labels a route declared with several paths with its first pattern', async () => {
    await request(app).get('/metrics-test/ping').expect(200);

    const routes = await routeLabelsFor('200');
    expect(routes).toContain('/metrics-test/status');
    expect(routes).not.toContain('/metrics-test/ping');
  });

  it('labels requests without a matched route as unmatched', async () => {
    await request(app).get('/wp-admin/setup-config.php').expect(404);
    await request(app).get('/.env').expect(404);

    const routes = await routeLabelsFor('404');
    expect(routes).toEqual(['unmatched']);
  });

  it('labels responses ended by a router middleware before route matching as unmatched', async () => {
    await request(app).get('/metrics-test/protected/secret').expect(401);

    const routes = await routeLabelsFor('401');
    expect(routes).toEqual(['unmatched']);
  });

  it('records the request duration with the same labels', async () => {
    await request(app).get('/metrics-test/health').expect(200);

    const output = await metricsRegistry.metrics();
    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="/metrics-test/health",status_code="200"}'
    );
    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="unmatched",status_code="404"}'
    );
  });
});
