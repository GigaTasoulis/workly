export async function onRequest({ request, env }: any) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  try {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const redirectUri = computeRedirectUri(env, origin);
    if (!clientId || !clientSecret) return json({ error: "Missing Google client env" }, 500);

    // --- Read params
    const qs = url.searchParams;
    const code = (qs.get("code") || "").trim();
    const state = (qs.get("state") || "").trim();
    if (!code) return json({ error: "Missing code" }, 400);
    if (!state) return json({ error: "Missing state" }, 400);

    // --- Read cookies set by /start
    const cookie = request.headers.get("cookie") || "";
    const gotState = readCookie(cookie, "g_state");
    const verifier = readCookie(cookie, "g_verifier");
    if (!gotState) return json({ error: "Missing state cookie" }, 400);
    if (gotState !== state) return json({ error: "State mismatch" }, 400);
    if (!verifier) return json({ error: "Missing PKCE verifier" }, 400);

    // --- Exchange code for tokens (extra logging)
    let tokenRes: Response;
    let tokenText = "";
    try {
      tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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
      tokenText = await tokenRes.text();
    } catch (e: any) {
      console.error("Token request threw:", e);
      return json({ error: "token_request_failed", message: String(e) }, 500);
    }

    if (!tokenRes.ok) {
      // This shows the real Google error (e.g. redirect_uri_mismatch, invalid_grant)
      console.error("Token exchange failed:", tokenRes.status, tokenText);
      return json({
        error: "token_exchange_failed",
        status: tokenRes.status,
        details: safeJSON(tokenText),
      }, 500);
    }

    const tokenJson = safeJSON(tokenText);
    const accessToken = tokenJson?.access_token as string;
    if (!accessToken) return json({ error: "No access token", details: tokenJson }, 500);

    // --- Fetch user info
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const infoText = await infoRes.text();
    if (!infoRes.ok) {
      console.error("userinfo failed:", infoRes.status, infoText);
      return json({ error: "userinfo_failed", status: infoRes.status, details: safeJSON(infoText) }, 500);
    }
    const info = safeJSON(infoText) || {};
    const sub = String(info.sub || "");
    const email = (info.email ? String(info.email) : "").toLowerCase();
    const name = String(info.name || "");
    const picture = String(info.picture || "");

    // --- Link/create local user
    const provider = "google";
    let userId: string | null = null;

    const ident = await env.DB
      .prepare("SELECT user_id FROM auth_identities WHERE provider = ? AND provider_id = ?")
      .bind(provider, sub)
      .first();

    if (ident?.user_id) {
      userId = String(ident.user_id);
    } else {
      let existingUser = null;
      if (email) {
        existingUser = await env.DB
          .prepare("SELECT id FROM auth_users WHERE username = ?")
          .bind(email)
          .first();
      }
      if (existingUser?.id) {
        userId = String(existingUser.id);
      } else {
        userId = crypto.randomUUID().replace(/-/g, "");
        const username = email || `google_${sub}`;
        await env.DB
          .prepare("INSERT INTO auth_users (id, username, created_at) VALUES (?, ?, strftime('%s','now'))")
          .bind(userId, username)
          .run();
      }
      await env.DB
        .prepare(`INSERT OR IGNORE INTO auth_identities
                  (user_id, provider, provider_id, email, name, picture)
                  VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(userId, provider, sub, email || null, name || null, picture || null)
        .run();
    }

    // --- Create session
    const sid = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    await env.DB
      .prepare("INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(sid, userId, expiresAt)
      .run();

    // --- Create session (… you already have the code that inserts to DB) ---

    const secure = url.protocol === "https:" ? "; Secure" : "";
    const cookies = [
      // clear temp
      `g_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `g_verifier=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      // session
      `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`,
    ];

    // IMPORTANT: append each Set-Cookie separately
    const h = new Headers({ Location: "/" });
    for (const c of cookies) h.append("Set-Cookie", c);

    return new Response(null, { status: 302, headers: h });

  } catch (err: any) {
    console.error("google/callback fatal:", err?.stack || err);
    return json({ error: "internal_error" }, 500);
  }
}

function json(data: any, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

function safeJSON(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}

function readCookie(cookieHeader: string, name: string) {
  const m = cookieHeader.match(new RegExp(`(?:^|;)\\s*${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function computeRedirectUri(env: any, origin: string) {
  // Prefer explicit env var to avoid subtle mismatches
  return (env.GOOGLE_REDIRECT_URI && String(env.GOOGLE_REDIRECT_URI)) || `${origin}/api/auth/google/callback`;
}
