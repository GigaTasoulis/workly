// functions/api/export.ts
// Tenant-scoped export: only rows with user_id = ownerId. No external types.

type D1Result<T = unknown> = { results: T[] | null };
interface D1PreparedStatement {
  all<T = unknown>(): Promise<D1Result<T>>;
  bind(...v: unknown[]): D1PreparedStatement;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface Env {
  DB: D1Database;
}
type Row = Record<string, unknown>;

const EXCLUDE = new Set([
  "sqlite_sequence",
  "d1_migrations",
  "auth_users",
  "auth_sessions",
  "auth_passwords",
  "oauth_identities",
  "auth_identities",
]);
const RESERVED = /^_(cf|d1|litestream|sqlite)_/i;

// --- Helpers: minimal SQL parser to discover columns (no PRAGMA) ---
function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  let quote: '"' | "'" | "`" | "]" | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if ((quote === "]" && ch === "]") || (quote !== "]" && ch === quote)) quote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "[") {
      quote = "]";
      buf += ch;
      continue;
    }
    if (ch === "(") {
      depth++;
      buf += ch;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      buf += ch;
      continue;
    }
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
function firstIdentifier(def: string): string | null {
  let i = 0;
  while (i < def.length && /\s/.test(def[i] as any)) i++;
  if (i >= def.length) return null;
  const ch = def[i];
  if (ch === '"' || ch === "`") {
    i++;
    let name = "";
    while (i < def.length && def[i] !== ch) name += def[i++];
    return name || null;
  }
  if (ch === "[") {
    i++;
    let name = "";
    while (i < def.length && def[i] !== "]") name += def[i++];
    return name || null;
  }
  let name = "";
  while (i < def.length && !/[\s(,]/.test(def[i] as any)) name += def[i++];
  return name || null;
}
function parseCreateTableColumns(createSql: string): string[] {
  const start = createSql.indexOf("("),
    end = createSql.lastIndexOf(")");
  if (start < 0 || end <= start) return [];
  const defs = splitTopLevelCommas(createSql.slice(start + 1, end));
  const cols: string[] = [];
  for (const def of defs) {
    const up = def.trim().toUpperCase();
    if (
      up.startsWith("PRIMARY KEY") ||
      up.startsWith("FOREIGN KEY") ||
      up.startsWith("UNIQUE") ||
      up.startsWith("CHECK") ||
      up.startsWith("CONSTRAINT")
    )
      continue;
    const name = firstIdentifier(def);
    if (name) cols.push(name);
  }
  return cols;
}
const qname = (name: string) => `"${name.replace(/"/g, '""')}"`;

// Blob-safe JSON encoding
const encodeValue = (v: unknown): unknown => {
  if (v instanceof ArrayBuffer) {
    const bytes = new Uint8Array(v);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { __type: "blob/base64", data: btoa(bin) };
  }
  if (v instanceof Uint8Array) {
    let bin = "";
    for (let i = 0; i < v.length; i++) bin += String.fromCharCode(v[i]);
    return { __type: "blob/base64", data: btoa(bin) };
  }
  return v;
};
const encodeRow = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, encodeValue(v)]));

export const onRequestGet = async ({
  env,
  request,
}: {
  env: Env;
  request: Request;
}): Promise<Response> => {
  const db = env.DB;
  const url = new URL(request.url);

  // In production: derive from session/auth. For now allow query param for local dev.
  const ownerId = (url.searchParams.get("ownerId") || "").trim();
  if (!ownerId) {
    return new Response(
      JSON.stringify(
        { error: "ownerId is required (use session on server in production)" },
        null,
        2,
      ),
      {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }

  // 1) Discover candidate tables
  const tableResp = await db
    .prepare(
      `
    SELECT name, sql FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `,
    )
    .all<{ name: string; sql: string | null }>();

  const candidates = (tableResp.results ?? [])
    .map((r) => ({ name: r.name, cols: parseCreateTableColumns(r.sql || "") }))
    .filter(({ name }) => !EXCLUDE.has(name) && !RESERVED.test(name));

  // 2) Keep only tables that have a user_id column
  const scopedTables = candidates.filter((c) => c.cols.includes("user_id")).map((c) => c.name);

  // 3) Read each table with WHERE user_id = :ownerId
  const read = async (name: string): Promise<Row[]> => {
    const qName = qname(name);
    // rowid ordering for determinism
    const stmt = db
      .prepare(`SELECT * FROM ${qName} WHERE "user_id" = ? ORDER BY rowid`)
      .bind(ownerId);
    try {
      const { results } = await stmt.all<Row>();
      return (results ?? []).map(encodeRow);
    } catch {
      // fallback (shouldn't happen if columns were parsed correctly)
      const { results } = await db
        .prepare(`SELECT * FROM ${qName} WHERE "user_id" = ?`)
        .bind(ownerId)
        .all<Row>();
      return (results ?? []).map(encodeRow);
    }
  };

  const payload: Record<string, unknown> = {};
  for (const t of scopedTables) payload[t] = await read(t);

  // 4) Meta: document what we exported and what we intentionally skipped
  const skippedNoUserId = candidates.filter((c) => !c.cols.includes("user_id")).map((c) => c.name);

  payload.__meta = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: "Cloudflare D1",
    filter: { column: "user_id", ownerId },
    tables: scopedTables,
    skipped: {
      noUserIdColumn: skippedNoUserId,
      excluded: [...EXCLUDE],
      reservedPattern: RESERVED.source,
    },
    notes: {
      ordering: "rowid",
      blobs: "BLOBs encoded as {__type:'blob/base64', data:'...'}",
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="backup_${ownerId}.json"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
};
