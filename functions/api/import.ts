// functions/api/import.ts
// D1 import with no PRAGMAs, reserved-table skip, and FK-safe delete/insert ordering.

type D1Result<T = unknown> = { results: T[] | null };
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<Array<unknown>>;
}
interface Env {
  DB: D1Database;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
type ExportPayload = {
  __meta?: { version?: number; exportedAt?: string; source?: string; tables?: string[] };
  [table: string]: JsonValue;
};
type TableReport = {
  table: string;
  rowsInFile: number;
  columnsInDB: string[];
  missingColumns: string[];
  extraFields: string[];
  inserted?: number;
};
type ImportReport = {
  dryRun: boolean;
  ok: boolean;
  tablesConsidered: number;
  tablesMissingInDB: string[];
  tablesSkipped: string[];
  tables: TableReport[];
  warnings: string[];
};

// ---------- helpers (schema parsing, quoting, blob decode) ----------
function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let buf = "",
    depth = 0;
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
const decodeBlobish = (v: unknown): unknown => {
  if (
    v &&
    typeof v === "object" &&
    (v as any).__type === "blob/base64" &&
    typeof (v as any).data === "string"
  ) {
    const b64 = (v as { data: string }).data;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return v;
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// functions/api/import.ts

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const db = env.DB;

  // Body -> JSON
  let payload: ExportPayload;
  try {
    payload = JSON.parse(await request.text()) as ExportPayload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const url = new URL(request.url);
  const commit = url.searchParams.has("commit");
  const ownerId = (url.searchParams.get("ownerId") || "").trim();
  const mode = (url.searchParams.get("mode") || "replace").toLowerCase(); // "replace" | "merge"

  const SYSTEM_KEYS = new Set(["__meta"]);
  const candidateTables = Object.keys(payload).filter((k) => !SYSTEM_KEYS.has(k));

  // Discover DB tables
  const tableResp = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`,
    )
    .all<{ name: string }>();
  const dbTables = new Set((tableResp.results ?? []).map((r) => r.name));

  const missingInDB: string[] = [];
  const importables = candidateTables.filter((t) => {
    const exists = dbTables.has(t);
    if (!exists) missingInDB.push(t);
    return exists;
  });

  // Column discovery WITHOUT PRAGMA (safe on D1)
  const getColumns = async (table: string): Promise<string[]> => {
    const { results } = await db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?`)
      .bind(table)
      .all<{ sql: string | null }>();
    const createSql = results?.[0]?.sql || "";
    return createSql ? parseCreateTableColumns(createSql) : [];
  };

  // Build dry-run report first (no writes)
  const reports: TableReport[] = [];
  for (const table of importables) {
    const rows = Array.isArray(payload[table])
      ? (payload[table] as Array<Record<string, JsonValue>>)
      : [];
    const cols = await getColumns(table);
    const fieldSeen = new Set<string>();
    for (const r of rows) Object.keys(r ?? {}).forEach((k) => fieldSeen.add(k));

    reports.push({
      table,
      rowsInFile: rows.length,
      columnsInDB: cols,
      missingColumns: [...fieldSeen].filter((f) => !cols.includes(f)),
      extraFields: cols.filter((c) => !fieldSeen.has(c)),
    });
  }

  if (!commit) {
    return json(<ImportReport>{
      dryRun: true,
      ok: true,
      tablesConsidered: importables.length,
      tablesMissingInDB: missingInDB,
      tablesSkipped: candidateTables.filter((t) => !importables.includes(t)),
      tables: reports,
      warnings: [],
    });
  }

  // --- COMMIT path ---
  try {
    if (!ownerId) {
      return json(
        <ImportReport>{
          dryRun: false,
          ok: false,
          tablesConsidered: importables.length,
          tablesMissingInDB: missingInDB,
          tablesSkipped: candidateTables.filter((t) => !importables.includes(t)),
          tables: reports,
          warnings: ["ownerId is required for commit (so we can scope deletes/inserts)"],
        },
        400,
      );
    }

    // Discover ALL tables (to purge for this ownerId where applicable)
    const schemaResp = await db
      .prepare(
        `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`,
      )
      .all<{ name: string; sql: string | null }>();

    const RESERVED = /^_(cf|d1|litestream|sqlite)_/i;
    const allWithCols = (schemaResp.results ?? [])
      .map((r) => ({ name: r.name, cols: parseCreateTableColumns(r.sql || "") }))
      .filter(({ name }) => !RESERVED.test(name));

    // Tables that are owner-scoped (have user_id)
    const allScoped = allWithCols.filter((t) => t.cols.includes("user_id")).map((t) => t.name);

    // FK-safe order
    const IMPORT_ORDER = [
      "workplaces",
      "customers",
      "suppliers",
      "employees",
      "customer_transactions",
      "supplier_transactions",
      "worklogs",
      "payroll_transactions",
      "customer_payments",
      "supplier_payments",
      "payroll_payments",
      "transactions",
    ];
    const rank = (t: string) => {
      const i = IMPORT_ORDER.indexOf(t);
      return i === -1 ? 999 : i;
    };

    // Foreign-key rewrite map: table -> [[fkColumn, targetTable], ...]
    const FK_MAP: Record<string, Array<[string, string]>> = {
      // parents
      // children referencing parents
      worklogs: [
        ["employee_id", "employees"],
        ["workplace_id", "workplaces"],
      ],
      customer_transactions: [["customer_id", "customers"]],
      supplier_transactions: [["supplier_id", "suppliers"]],
      payroll_transactions: [
        ["employee_id", "employees"],
        ["worklog_id", "worklogs"],
      ],
      // payments referencing their transactions and parents
      customer_payments: [
        ["transaction_id", "customer_transactions"],
        ["customer_id", "customers"],
      ],
      supplier_payments: [
        ["transaction_id", "supplier_transactions"],
        ["supplier_id", "suppliers"],
      ],
      payroll_payments: [
        ["transaction_id", "payroll_transactions"],
        ["worklog_id", "worklogs"],
        ["employee_id", "employees"],
      ],
      // if you use generic transactions referencing customers:
      transactions: [["customer_id", "customers"]],
    };

    const stmts: D1PreparedStatement[] = [];

    // 1) Purge existing rows for this ownerId (children → parents)
    //    ONLY in replace mode
    if (mode === "replace") {
      for (const t of [...allScoped].sort((a, b) => rank(b) - rank(a))) {
        stmts.push(db.prepare(`DELETE FROM ${qname(t)} WHERE "user_id" = ?`).bind(ownerId));
      }
    }

    // 2) Prepare meta for incoming data
    type WithMeta = { table: string; cols: string[]; rows: Array<Record<string, JsonValue>> };
    const metas: WithMeta[] = await Promise.all(
      importables.map(async (t) => ({
        table: t,
        cols: reports.find((r) => r.table === t)?.columnsInDB ?? [],
        rows: Array.isArray(payload[t]) ? (payload[t] as Array<Record<string, JsonValue>>) : [],
      })),
    );

    // 3) Load existing IDs from DB to detect collisions (for tables we will insert into)
    const existingIds: Record<string, Set<string>> = {};
    for (const m of metas) {
      if (!m.cols.includes("id")) continue;
      const { results } = await db
        .prepare(`SELECT id FROM ${qname(m.table)}`)
        .all<{ id: unknown }>();
      const set = new Set<string>();
      for (const r of results ?? []) if (r?.id != null) set.add(String(r.id));
      existingIds[m.table] = set;
    }

    // 4) ID remapping store: per-table oldId -> newId
    const idMap: Record<string, Map<string, string>> = {};
    const ensureMap = (t: string) => (idMap[t] ||= new Map<string, string>());

    // Generator for new IDs (UUID v4 without dashes -> 32 chars)
    const newId = () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "")
        : (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 32);

    // 5) Inserts (parents → children) with PK collision handling + FK rewrites
    const toInsert = metas
      .filter((m) => m.rows.length > 0 && m.cols.length > 0)
      .sort((a, b) => rank(a.table) - rank(b.table));

    const decode = decodeBlobish;

    for (const { table, cols, rows } of toInsert) {
      const placeholders = `(${cols.map(() => "?").join(",")})`;
      const sql = `INSERT INTO ${qname(table)} (${cols.map(qname).join(",")}) VALUES ${placeholders}`;
      const prepared = db.prepare(sql);

      const hasId = cols.includes("id");
      const hasUserId = cols.includes("user_id");
      const existing = existingIds[table] || new Set<string>();
      const fkInfo = FK_MAP[table] || [];

      for (const r of rows) {
        // 5a) start with row and force user_id = ownerId if present
        const base: Record<string, unknown> = { ...(r as Record<string, unknown>) };
        if (hasUserId) base["user_id"] = ownerId;

        // 5b) handle PK collision for this table
        if (hasId) {
          const old = base["id"] != null ? String(base["id"]) : newId();
          const map = ensureMap(table);
          let mapped = map.get(old);
          if (!mapped) {
            mapped = existing.has(old) ? newId() : old;
            map.set(old, mapped);
            existing.add(mapped);
          }
          base["id"] = mapped;
        }

        // 5c) rewrite foreign keys to mapped IDs of target tables
        for (const [fkCol, targetTable] of fkInfo) {
          if (!cols.includes(fkCol)) continue;
          const v = base[fkCol];
          if (v == null) continue;
          const mapped = idMap[targetTable]?.get(String(v));
          if (mapped) base[fkCol] = mapped;
        }

        // 5d) bind in column order
        const vals = cols.map((c) => decode(base[c] ?? null));
        stmts.push(prepared.bind(...vals));
      }
    }

    // 6) Execute atomically
    await db.batch(stmts);

    for (const rep of reports) rep.inserted = rep.rowsInFile;

    return json(<ImportReport>{
      dryRun: false,
      ok: true,
      tablesConsidered: importables.length,
      tablesMissingInDB: missingInDB,
      tablesSkipped: candidateTables.filter((t) => !importables.includes(t)),
      tables: reports,
      warnings: [],
    });
  } catch (e) {
    return json(
      <ImportReport>{
        dryRun: false,
        ok: false,
        tablesConsidered: importables.length,
        tablesMissingInDB: missingInDB,
        tablesSkipped: candidateTables.filter((t) => !importables.includes(t)),
        tables: reports,
        warnings: [`Import aborted due to error: ${(e as Error)?.message ?? String(e)}`],
      },
      500,
    );
  }
};
