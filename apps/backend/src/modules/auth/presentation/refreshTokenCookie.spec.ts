import { describe, expect, it, jest } from "@jest/globals";
import { REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_PATH, RefreshTokenCookie } from "./refreshTokenCookie.js";

const ONE_WEEK_MS = 604800000;

describe("RefreshTokenCookie", () => {
  it("writes the refresh token as an httpOnly, SameSite=Strict cookie restricted to the auth routes", () => {
    const response = { cookie: jest.fn() };

    new RefreshTokenCookie({ secure: true, maxAgeMs: ONE_WEEK_MS }).write(response as any, "opaque-token");

    expect(response.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, "opaque-token", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: ONE_WEEK_MS
    });
    expect(REFRESH_TOKEN_COOKIE_PATH).toBe("/api/v1/auth");
  });

  it("clears the cookie with the same attributes so the browser matches and removes it", () => {
    const response = { clearCookie: jest.fn() };

    new RefreshTokenCookie({ secure: false, maxAgeMs: ONE_WEEK_MS }).clear(response as any);

    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: REFRESH_TOKEN_COOKIE_PATH
    });
  });

  it("reads the token from the parsed cookies and ignores missing or empty values", () => {
    const cookie = new RefreshTokenCookie({ secure: true, maxAgeMs: ONE_WEEK_MS });

    expect(cookie.read({ cookies: { [REFRESH_TOKEN_COOKIE_NAME]: "abc" } } as any)).toBe("abc");
    expect(cookie.read({ cookies: { [REFRESH_TOKEN_COOKIE_NAME]: "" } } as any)).toBeUndefined();
    expect(cookie.read({ cookies: {} } as any)).toBeUndefined();
    expect(cookie.read({} as any)).toBeUndefined();
  });
});
