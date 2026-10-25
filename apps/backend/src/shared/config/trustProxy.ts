const TRUST_PROXY_PATTERN = /^\d+$/;
const PROXY_TRUST_DISABLED = 0;

/**
 * Number of reverse proxies in front of the API (ADR 0011). Express uses it to read the real client
 * IP from X-Forwarded-For, which the rate limiters depend on. A hop count is used instead of `true`
 * because `true` would trust any X-Forwarded-For sent by the client and let it bypass the limits.
 */
export const parseTrustProxy = (value: string | undefined): number => {
  const normalized = value?.trim() ?? "";
  if (normalized === "") return PROXY_TRUST_DISABLED;
  if (!TRUST_PROXY_PATTERN.test(normalized)) {
    throw new Error("TRUST_PROXY deve ser um inteiro maior ou igual a 0");
  }
  return Number(normalized);
};
