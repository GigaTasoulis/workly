export async function onRequest({ request, env }: any) {
  const url = new URL(request.url);

  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = computeRedirectUri(env, request);
  if (!clientId) return json({ error: "Missing GOOGLE_CLIENT_ID" }, 500);

  // --- PKCE ---
  const codeVerifier = base64url(randomBytes(32)); // 43+ chars
  const codeChallenge = await sha256Base64Url(codeVerifier);

  // CSRF state
  const state = base64url(randomBytes(16));

  // Build Google auth URL (single build)
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    prompt: "consent",
  }).toString();

  // Cookies: name them to match the callback
  const isSecure = url.protocol === "https:";
  const headers = new Headers({ Location: authUrl.toString() });
  headers.append("Set-Cookie", cookie("g_verifier", codeVerifier, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: isSecure,
    maxAge: 600,
  }));
  headers.append("Set-Cookie", cookie("g_state", state, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: isSecure,
    maxAge: 600,
  }));

  return new Response(null, { status: 302, headers });
}


  
  // --- helpers ---
  function json(data: any, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
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
  type CookieOpts = { httpOnly?: boolean; path?: string; sameSite?: "Lax"|"Strict"|"None"; secure?: boolean; maxAge?: number };
  function cookie(name: string, value: string, opts: CookieOpts = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
    if (opts.path) parts.push(`Path=${opts.path}`);
    if (opts.httpOnly) parts.push("HttpOnly");
    if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
    if (opts.secure) parts.push("Secure");
    return parts.join("; ");
  }
  

function computeRedirectUri(env: any, req: Request) {
  const u = new URL(req.url);
  // Prefer explicit env (works in prod), fall back to computed (works in local dev)
  return env.GOOGLE_REDIRECT_URI || `${u.origin}/api/auth/google/callback`;
}
