import { describe, expect, it } from "@jest/globals";
import { parseTrustProxy } from "./trustProxy.js";

describe("parseTrustProxy", () => {
  it("disables proxy trust when the variable is not set", () => {
    expect(parseTrustProxy(undefined)).toBe(0);
    expect(parseTrustProxy("")).toBe(0);
  });

  it("accepts the number of trusted proxy hops", () => {
    expect(parseTrustProxy("0")).toBe(0);
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy(" 2 ")).toBe(2);
  });

  it.each(["true", "-1", "1.5", "abc", "loopback"])("rejects %p so a misconfiguration fails at startup", (value) => {
    expect(() => parseTrustProxy(value)).toThrow("TRUST_PROXY deve ser um inteiro maior ou igual a 0");
  });
});
