// functions/api/auth/google/start.ts
import { checkRate, getClientIp } from "../../_utils/ratelimit";

export async function onRequest({ request, env }: any) {
  const url = new URL(request.url);

  // ---- Rate limit: 5/min + 50/hour per IP for OAuth start ----
  const ip = getClientIp(request);

  const perMinute = await checkRate(env, ["oauth_start", ip, "m"], 5, 60);
  if (!perMinute.allowed) {
    return new Response(JSON.stringify({ error: "rate_limited", retryAfter: perMinute.reset }), {
      status: 429,
      headers: { "content-type": "application/json", "Retry-After": String(perMinute.reset) },
    });
  }

  const perHour = await checkRate(env, ["oauth_start", ip, "h"], 50, 3600);
  if (!perHour.allowed) {
    return new Response(JSON.stringify({ error: "rate_limited", retryAfter: perHour.reset }), {
      status: 429,
      headers: { "content-type": "application/json", "Retry-After": String(perHour.reset) },
    });
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) return json({ error: "Missing GOOGLE_CLIENT_ID" }, 500);

  const redirectUri = computeRedirectUri(env, request);
  const scope = "openid email profile";

  // --- PKCE + CSRF state
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = base64url(randomBytes(16));

  // Optional: where to go after login
  const returnTo = url.searchParams.get("returnTo") || "/";

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  // authUrl.searchParams.set("prompt", "consent"); // uncomment if you always want consent

  // Cookies set on the API origin (localhost:8788 in dev)
  const isSecure = new URL(request.url).protocol === "https:";
  const headers = new Headers({ Location: authUrl.toString() });

  headers.append(
    "Set-Cookie",
    cookie("oauth_state", state, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecure,
      path: "/",
      maxAge: 600,
    }),
  );
  headers.append(
    "Set-Cookie",
    cookie("pkce_verifier", codeVerifier, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecure,
      path: "/",
      maxAge: 600,
    }),
  );
  headers.append(
    "Set-Cookie",
    cookie("return_to", encodeURIComponent(returnTo), {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecure,
      path: "/",
      maxAge: 600,
    }),
  );

  return new Response(null, { status: 302, headers });
}

/* helpers */
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function randomBytes(len: number) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return a;
}
async function sha256Base64Url(input: string) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return base64url(new Uint8Array(digest));
}
function base64url(bytes: Uint8Array) {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
type CookieOpts = {
  httpOnly?: boolean;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
  maxAge?: number;
};
function cookie(name: string, value: string, opts: CookieOpts = {}) {
  const parts = [`${name}=${value}`];
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}
function computeRedirectUri(env: any, req: Request) {
  const u = new URL(req.url);
  return env.GOOGLE_REDIRECT_URI || `${u.origin}/api/auth/google/callback`;
}
