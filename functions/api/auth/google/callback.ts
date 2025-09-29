// functions/api/auth/google/callback.ts
export async function onRequest({ request, env }: any) {
  const url = new URL(request.url);
  const origin = url.origin;

  try {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return json({ error: "Missing Google client env" }, 500);

    const redirectUri = computeRedirectUri(env, request);

    // --- Query params
    const code = (url.searchParams.get("code") || "").trim();
    const state = (url.searchParams.get("state") || "").trim();
    if (!code) return json({ error: "Missing code" }, 400);
    if (!state) return json({ error: "Missing state" }, 400);

    // --- Cookies from /start
    const cookieHeader = request.headers.get("cookie") || "";
    const cookieState = readCookie(cookieHeader, "oauth_state");
    const verifier = readCookie(cookieHeader, "pkce_verifier");
    const returnTo = decodeURIComponent(readCookie(cookieHeader, "return_to") || "/");

    if (!cookieState) return json({ error: "Missing state cookie" }, 400);
    if (cookieState !== state) return json({ error: "State mismatch" }, 400);
    if (!verifier) return json({ error: "Missing PKCE verifier" }, 400);

    // --- Exchange code for tokens (show real error if it fails)
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return json(
        { error: "token_exchange_failed", status: tokenRes.status, details: safeJSON(tokenText) },
        500,
      );
    }
    const tokens = safeJSON(tokenText) || {};
    const accessToken = String(tokens.access_token || "");
    if (!accessToken) return json({ error: "No access token", details: tokens }, 500);

    // --- Fetch userinfo
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const infoText = await infoRes.text();
    if (!infoRes.ok) {
      return json(
        { error: "userinfo_failed", status: infoRes.status, details: safeJSON(infoText) },
        500,
      );
    }
    const info = safeJSON(infoText) || {};
    const sub = String(info.sub || "");
    const email = (info.email ? String(info.email) : "").toLowerCase();
    const name = String(info.name || "");
    const picture = String(info.picture || "");

    // --- Link or create local user
    const provider = "google";
    let userId: string | null = null;

    const ident = await env.DB.prepare(
      "SELECT user_id FROM auth_identities WHERE provider = ? AND provider_id = ?",
    )
      .bind(provider, sub)
      .first();

    if (ident?.user_id) {
      userId = String(ident.user_id);
    } else {
      // if email already exists, link to that user; else create a new user
      let existingUser = null;
      if (email) {
        existingUser = await env.DB.prepare("SELECT id FROM auth_users WHERE username = ?")
          .bind(email)
          .first();
      }
      if (existingUser?.id) {
        userId = String(existingUser.id);
      } else {
        userId = crypto.randomUUID().replace(/-/g, "");
        const username = email || `google_${sub}`;
        await env.DB.prepare(
          "INSERT INTO auth_users (id, username, created_at) VALUES (?, ?, strftime('%s','now'))",
        )
          .bind(userId, username)
          .run();
      }

      await env.DB.prepare(
        `INSERT OR IGNORE INTO auth_identities
           (user_id, provider, provider_id, email, name, picture, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CAST(strftime('%s','now') AS INTEGER))`,
      )
        .bind(userId, provider, sub, email || null, name || null, picture || null)
        .run();
    }

    // --- Create a session
    const sid = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
    await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(sid, userId, expiresAt)
      .run();

    const secure = url.protocol === "https:" ? "; Secure" : "";
    const cookies = [
      `oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `pkce_verifier=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `return_to=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`,
    ];

    return new Response(null, {
      status: 302,
      headers: { "Set-Cookie": cookies, Location: returnTo || "/" },
    });
  } catch (err: any) {
    console.error("google/callback fatal:", err?.stack || err);
    return json({ error: "internal_error" }, 500);
  }
}

/* helpers */
function json(data: any, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}
function safeJSON(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function readCookie(cookieHeader: string, name: string) {
  const m = cookieHeader.match(new RegExp(`(?:^|;)\\s*${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function computeRedirectUri(env: any, req: Request) {
  const u = new URL(req.url);
  return env.GOOGLE_REDIRECT_URI || `${u.origin}/api/auth/google/callback`;
}
