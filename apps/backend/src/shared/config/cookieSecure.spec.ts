import { describe, expect, it } from "@jest/globals";
import { parseCookieSecure } from "./cookieSecure.js";

describe("parseCookieSecure", () => {
  it("defaults to Secure only in production when the variable is not set", () => {
    expect(parseCookieSecure(undefined, "production")).toBe(true);
    expect(parseCookieSecure("", "production")).toBe(true);
    expect(parseCookieSecure(undefined, "development")).toBe(false);
    expect(parseCookieSecure(undefined, "test")).toBe(false);
  });

  it("follows an explicit true or false", () => {
    expect(parseCookieSecure("true", "development")).toBe(true);
    expect(parseCookieSecure(" FALSE ", "production")).toBe(false);
  });

  it.each(["1", "yes", "sim", "on"])("rejects %p so a misconfiguration fails at startup", (value) => {
    expect(() => parseCookieSecure(value, "production")).toThrow("COOKIE_SECURE deve ser true ou false");
  });
});
