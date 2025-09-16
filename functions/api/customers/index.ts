export async function onRequest({ request, env }: any) {
  const method = request.method.toUpperCase();

  const ORIGINS = new Set([
    "http://localhost:3000",
    "http://localhost:8788",
    "https://workly-122.pages.dev",
  ]);
  const origin = request.headers.get("origin") || "";
  const cors = (extra: Record<string, string> = {}) => {
    const h: Record<string, string> = { "content-type": "application/json", ...extra };
    if (ORIGINS.has(origin)) {
      h["access-control-allow-origin"] = origin;
      h["access-control-allow-credentials"] = "true";
      h["vary"] = "Origin";
      h["access-control-allow-headers"] = "content-type";
      h["access-control-allow-methods"] = "GET,POST,OPTIONS";
    }
    return h;
  };

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  const user = await getUserFromSession(env, request);
  if (!user) return json({ error: "Unauthorized" }, 401, cors());

  // Pick whichever table exists
  const txTable = (await hasTable(env, "customer_transactions"))
    ? "customer_transactions"
    : (await hasTable(env, "transactions")) ? "transactions" : null;

  if (method === "GET") {
    // If no tx table exists yet, just return customers with debt=0
    if (!txTable) {
      const rows = await env.DB.prepare(
        `SELECT id, name, contact_person, email, phone, address, afm, tractor, notes, created_at
           FROM customers
          WHERE user_id = ?
          ORDER BY created_at DESC`
      ).bind(user.user_id).all();
      const customers = (rows.results ?? []).map((r: any) => ({ ...r, debt: 0 }));
      return json({ customers }, 200, cors());
    }

    // Return customers + computed debt from pending transactions
    const rows = await env.DB.prepare(
      `SELECT
          c.id, c.name, c.contact_person, c.email, c.phone, c.address, c.afm, c.tractor, c.notes, c.created_at,
          COALESCE((
            SELECT SUM(t.amount - IFNULL(t.amount_paid, 0))
              FROM ${txTable} t
             WHERE t.user_id = c.user_id
               AND t.customer_id = c.id
               AND t.status = 'pending'
          ), 0) AS debt
         FROM customers c
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC`
    ).bind(user.user_id).all();

    return json({ customers: rows.results ?? [] }, 200, cors());
  }

  if (method === "POST") {
    const b = await safeJson(request);
    const name = String(b?.name ?? "").trim();
    if (!name) return json({ error: "name is required" }, 400, cors());

    const id = crypto.randomUUID().replace(/-/g, "");
    const contact_person = String(b?.contact_person ?? "").trim();
    const email          = String(b?.email ?? "").trim();
    const phone          = String(b?.phone ?? "").trim();
    const address        = String(b?.address ?? "").trim();
    const afm            = String(b?.afm ?? "").trim();
    const tractor        = String(b?.tractor ?? "").trim();
    const notes          = String(b?.notes ?? "").trim().slice(0, 2000);

    // owner_id detection preserved (if you had it earlier)
    const hasOwnerId = await env.DB
      .prepare("SELECT 1 AS ok FROM pragma_table_info('customers') WHERE name='owner_id' LIMIT 1;")
      .first();

    if (hasOwnerId?.ok) {
      await env.DB.prepare(
        `INSERT INTO customers
           (id, user_id, owner_id, name, contact_person, email, phone, address, afm, tractor, notes)
         VALUES (?,  ?,      ?,        ?,    ?,              ?,    ?,     ?,       ?,   ?,       ?)`
      ).bind(id, user.user_id, user.user_id, name, contact_person, email, phone, address, afm, tractor, notes).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO customers
           (id, user_id, name, contact_person, email, phone, address, afm, tractor, notes)
         VALUES (?,  ?,      ?,    ?,              ?,    ?,     ?,       ?,   ?,       ?)`
      ).bind(id, user.user_id, name, contact_person, email, phone, address, afm, tractor, notes).run();
    }

    return json({ customer: { id, name, contact_person, email, phone, address, afm, tractor, notes } }, 201, cors());
  }

  return json({ error: "Method not allowed" }, 405, cors());
}

/* helpers */
function json(data: any, status = 200, headers?: Record<string,string>) {
  return new Response(JSON.stringify(data), { status, headers });
}
async function safeJson(req: Request) { try { return await req.json(); } catch { return null; } }
async function hasTable(env: any, name: string) {
  const r = await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").bind(name).first();
  return !!r;
}
async function getUserFromSession(env: any, request: Request) {
  const m = (request.headers.get("cookie") || "").match(/\bsession=([^;]+)/);
  if (!m) return null;
  const sid = decodeURIComponent(m[1]);
  const now = Math.floor(Date.now() / 1000);
  return await env.DB.prepare(
    `SELECT u.id AS user_id, u.username
       FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`
  ).bind(sid, now).first();
}
