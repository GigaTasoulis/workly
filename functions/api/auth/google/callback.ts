// functions/api/auth/google/callback.ts
import { hash } from "bcryptjs";

export async function onRequest({ request, env }: any) {
  const url = new URL(request.url);

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

    // --- Exchange code for tokens
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
    const ID_TABLE = "auth_identities";

    // tiny helper: never pass undefined to D1
    const nn = (v: any) => (v === undefined ? null : v);

    // 1) Look up identity by provider/sub
    const identRow = (await env.DB.prepare(
      `SELECT user_id FROM ${ID_TABLE} WHERE provider = ? AND provider_id = ?`,
    )
      .bind(provider, sub)
      .first()) as { user_id?: string } | null;

    let userId: string | undefined = identRow?.user_id;

    // 2) If not linked, try to find existing user by email (username)
    if (!userId) {
      let existing: { id?: string } | null = null;
      if (email) {
        existing = (await env.DB.prepare("SELECT id FROM auth_users WHERE username = ?")
          .bind(email)
          .first()) as any;
      }

      if (existing?.id) {
        userId = String(existing.id);
      } else {
        // 3) Create a new local user with a dummy bcrypt hash (password_hash is NOT NULL)
        userId = crypto.randomUUID();
        const username = email || `google_${sub}`;
        const dummyHash = await hash(crypto.randomUUID(), 12);

        await env.DB.prepare(
          "INSERT INTO auth_users (id, username, password_hash) VALUES (?, ?, ?)",
        )
          .bind(userId, username, dummyHash)
          .run();
      }

      // 4) Link identity
      await env.DB.prepare(
        `INSERT OR IGNORE INTO ${ID_TABLE}
           (user_id, provider, provider_id, email, name, picture, created_at)
         VALUES (?, ?, ?, ?, ?, ?, unixepoch())`,
      )
        .bind(userId, provider, sub, nn(email), nn(name), nn(picture))
        .run();
    }

    if (!userId) {
      // extra guard so we never bind undefined to D1
      return json({ error: "user_link_failed" }, 500);
    }

    // --- Create a session
    const sid = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

    await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(sid, userId, expiresAt)
      .run();

    // --- Clear temp cookies and set session
    const secure = url.protocol === "https:" ? "; Secure" : "";
    const headers = new Headers({ Location: returnTo || "/" });
    headers.append(
      "Set-Cookie",
      `oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    );
    headers.append(
      "Set-Cookie",
      `pkce_verifier=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    );
    headers.append("Set-Cookie", `return_to=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    headers.append(
      "Set-Cookie",
      `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
        60 * 60 * 24 * 30
      }${secure}`,
    );

    return new Response(null, { status: 302, headers });
  } catch (err: any) {
    console.error("google/callback fatal:", err?.stack || err);
    return json({ error: "internal_error", detail: String(err?.message || err) }, 500);
  }
}

/* helpers (unchanged) */
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
