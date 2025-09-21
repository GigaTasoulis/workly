// List and create suppliers for the current user
export async function onRequest({ request, env }: any) {
  const method = request.method.toUpperCase();

  // ---- CORS (dev) ----
  const ORIGINS = new Set([
    "http://localhost:3000",
    "http://localhost:8788",
    "https://workly-122.pages.dev",
  ]);
  const origin = request.headers.get("origin") || "";
  const cors = (extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...extra,
    };
    if (ORIGINS.has(origin)) {
      headers["access-control-allow-origin"] = origin;
      headers["access-control-allow-credentials"] = "true";
      headers["vary"] = "Origin";
      headers["access-control-allow-headers"] = "content-type";
      headers["access-control-allow-methods"] = "GET,POST,OPTIONS";
    }
    return headers;
  };
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  // ---- Auth ----
  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  if (method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT
             s.id,
             s.name,
             s.contact_person,
             s.email,
             s.phone,
             s.address,
             s.notes,
             s.created_at,
             s.updated_at,
             COALESCE(SUM(
               CASE WHEN t.status = 'pending'
                    THEN (t.amount - t.amount_paid)
                    ELSE 0 END
             ), 0) AS debt
           FROM suppliers s
           LEFT JOIN supplier_transactions t
             ON t.user_id = s.user_id AND t.supplier_id = s.id
           WHERE s.user_id = ?
           GROUP BY s.id
           ORDER BY s.name`,
    )
      .bind(user.user_id)
      .all();

    return json({ suppliers: rows.results ?? [] }, 200, cors());
  }

  if (method === "POST") {
    const body = await safeJson(request);
    const name = (body?.name || "").trim();
    if (!name) return json({ error: "Name is required" }, 400, cors());

    const contact_person = (body?.contact_person || body?.contactPerson || "").trim().slice(0, 200);
    const email = (body?.email || "").trim().slice(0, 200);
    const phone = (body?.phone || "").trim().slice(0, 100);
    const address = (body?.address || "").trim().slice(0, 500);
    const notes = (body?.notes || "").trim().slice(0, 2000);

    const id = crypto.randomUUID().replace(/-/g, "");
    try {
      await env.DB.prepare(
        `INSERT INTO suppliers (id, user_id, name, contact_person, email, phone, address, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, user.user_id, name, contact_person, email, phone, address, notes)
        .run();
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("idx_suppliers_user_name")) {
        return json({ error: "Supplier name already exists" }, 409, cors());
      }
      return json({ error: "Insert failed" }, 500, cors());
    }

    return json(
      {
        supplier: { id, name, contact_person, email, phone, address, notes },
      },
      201,
      cors(),
    );
  }

  return json({ error: "Method not allowed" }, 405, cors());
}

// ---- helpers ----
function json(data: any, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}
async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
async function getUserFromSession(env: any, request: Request) {
  const m = (request.headers.get("cookie") || "").match(/\bsession=([^;]+)/);
  if (!m) return null;
  const sessionId = decodeURIComponent(m[1]);
  const now = Math.floor(Date.now() / 1000);
  return await env.DB.prepare(
    `SELECT u.id AS user_id, u.username
       FROM auth_sessions s
       JOIN auth_users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(sessionId, now)
    .first();
}
