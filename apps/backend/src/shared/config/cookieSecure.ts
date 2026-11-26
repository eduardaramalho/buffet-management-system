/**
 * Secure attribute of the refresh token cookie (ADR 0020). Production runs behind Caddy over HTTPS, so the
 * default is Secure there. Local HTTP runs (docker compose, E2E) need it off: browsers other than Chromium
 * drop Secure cookies on http://localhost. An explicit value avoids guessing from the URL.
 */
export const parseCookieSecure = (value: string | undefined, nodeEnv: string): boolean => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "") return nodeEnv === "production";
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error("COOKIE_SECURE deve ser true ou false");
};
