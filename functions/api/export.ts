// functions/api/export.ts
// Strongly typed, no external type imports (avoids Response clashes).

type D1Result<T = unknown> = { results: T[] | null };
interface D1PreparedStatement {
  all<T = unknown>(): Promise<D1Result<T>>;
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

export const onRequestGet = async ({ env }: { env: Env }): Promise<Response> => {
  const db = env.DB;

  // 1) Discover user tables
  const tableQuery = `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `;
  const tableResp = await db.prepare(tableQuery).all<{ name: string }>();
  const tables: string[] = (tableResp.results ?? [])
    .map((r) => r.name)
    .filter((n) => !EXCLUDE.has(n));

  // Blob-safe encoding for JSON round-trip
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

  // 2) Read each table with safe quoting + stable ordering
  const read = async (name: string): Promise<Row[]> => {
    const qName = `"${name.replace(/"/g, '""')}"`;
    const tryAll = async <T = Row>(sql: string) => (await db.prepare(sql).all<T>()).results ?? [];

    try {
      return (await tryAll<Row>(`SELECT * FROM ${qName} ORDER BY rowid`)).map(encodeRow);
    } catch {
      try {
        return (await tryAll<Row>(`SELECT * FROM ${qName} ORDER BY 1`)).map(encodeRow);
      } catch {
        try {
          return (await tryAll<Row>(`SELECT * FROM ${qName}`)).map(encodeRow);
        } catch {
          return [];
        }
      }
    }
  };

  const payload: Record<string, unknown> = {};
  for (const t of tables) payload[t] = await read(t);

  payload.__meta = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: "Cloudflare D1",
    tables,
    notes: {
      ordering: "rowid|1|none (fallback sequence)",
      blobs: "BLOBs encoded as {__type:'blob/base64', data:'...'}",
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="backup.json"`,
      "cache-control": "no-store",
      "x-download-options": "noopen",
      "x-content-type-options": "nosniff",
    },
  });
};
