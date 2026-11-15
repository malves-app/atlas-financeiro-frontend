// Ferramentas de teste: um Postgres local (PGlite) com o mesmo SQL do Supabase
// e um cliente que imita o subconjunto do supabase-js usado pelo site.
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

export async function setupDb() {
  const db = await PGlite.create();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon;
  -- Como no Supabase atual: tabelas novas não recebem acesso automático (o SQL do projeto precisa conceder).
  `);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  return db;
}

type Filter = { sql: string; params: unknown[] };
const ident = (s: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`coluna inválida: ${s}`);
  return `"${s}"`;
};

/** Imita `createServerClient(...)` do Supabase para um usuário, executando no PGlite com RLS. */
export function fakeSupabase(db: PGlite, userId: string, email = "teste@exemplo.com") {
  let queue = Promise.resolve();
  async function run<T>(sql: string, params: unknown[]): Promise<T[]> {
    const job = queue.then(async () => {
      await db.exec(`set role authenticated; set request.jwt.claim.sub = '${userId}';`);
      try {
        return (await db.query<T>(sql, params)).rows;
      } finally {
        await db.exec("reset role; reset request.jwt.claim.sub;");
      }
    });
    queue = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }

  class Query implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
    private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    private cols = "*";
    private rows: Record<string, unknown>[] = [];
    private values: Record<string, unknown> = {};
    private filters: Filter[] = [];
    private orders: string[] = [];
    private lim: number | null = null;
    private off: number | null = null;
    private returning = false;
    private mode: "many" | "single" | "maybe" = "many";
    private conflict: { cols: string[]; ignore: boolean } | null = null;
    constructor(private table: string) {}

    select(cols = "*") {
      if (this.op === "select") this.cols = cols;
      else this.returning = true;
      return this;
    }
    insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
      this.op = "insert";
      this.rows = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    upsert(rows: Record<string, unknown> | Record<string, unknown>[], opts: { onConflict: string; ignoreDuplicates?: boolean }) {
      this.op = "upsert";
      this.rows = Array.isArray(rows) ? rows : [rows];
      this.conflict = { cols: opts.onConflict.split(","), ignore: !!opts.ignoreDuplicates };
      return this;
    }
    update(values: Record<string, unknown>) {
      this.op = "update";
      this.values = values;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    private add(col: string, op: string, v: unknown) {
      this.filters.push({ sql: `${ident(col)} ${op} $?`, params: [v] });
      return this;
    }
    eq(c: string, v: unknown) {
      return this.add(c, "=", v);
    }
    gt(c: string, v: unknown) {
      return this.add(c, ">", v);
    }
    gte(c: string, v: unknown) {
      return this.add(c, ">=", v);
    }
    lte(c: string, v: unknown) {
      return this.add(c, "<=", v);
    }
    range(from: number, to: number) {
      this.off = from;
      this.lim = to - from + 1;
      return this;
    }
    in(c: string, vs: unknown[]) {
      if (!vs.length) {
        this.filters.push({ sql: "false", params: [] });
        return this;
      }
      this.filters.push({ sql: `${ident(c)} in (${vs.map(() => "$?").join(", ")})`, params: vs });
      return this;
    }
    or(expr: string) {
      const parts = expr.split(",").map((p) => {
        const [col, op, val] = p.split(".");
        if (op === "is") return `${ident(col)} is ${val === "null" ? "null" : val}`;
        if (op === "eq") return `${ident(col)} = ${val === "true" || val === "false" ? val : `'${val.replace(/'/g, "''")}'`}`;
        throw new Error("or() não suportado: " + p);
      });
      this.filters.push({ sql: `(${parts.join(" or ")})`, params: [] });
      return this;
    }
    order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}) {
      const asc = opts.ascending !== false;
      const nulls = opts.nullsFirst === undefined ? "" : opts.nullsFirst ? " nulls first" : " nulls last";
      this.orders.push(`${ident(col)} ${asc ? "asc" : "desc"}${nulls}`);
      return this;
    }
    limit(n: number) {
      this.lim = n;
      return this;
    }
    single() {
      this.mode = "single";
      return this;
    }
    maybeSingle() {
      this.mode = "maybe";
      return this;
    }

    private build(): { sql: string; params: unknown[] } {
      const params: unknown[] = [];
      const where = () => {
        if (!this.filters.length) return "";
        const parts = this.filters.map((f) => {
          let i = 0;
          return f.sql.replace(/\$\?/g, () => {
            params.push(f.params[i++]);
            return `$${params.length}`;
          });
        });
        return " where " + parts.join(" and ");
      };
      const t = `public.${ident(this.table)}`;
      const ret = this.returning || this.mode !== "many" ? " returning *" : "";
      if (this.op === "select") {
        const cols = this.cols === "*" ? "*" : this.cols.split(",").map((c) => ident(c.trim())).join(", ");
        return {
          sql: `select ${cols} from ${t}${where()}${this.orders.length ? " order by " + this.orders.join(", ") : ""}${this.lim != null ? ` limit ${this.lim}` : ""}${this.off != null ? ` offset ${this.off}` : ""}`,
          params,
        };
      }
      if (this.op === "insert" || this.op === "upsert") {
        const cols = [...new Set(this.rows.flatMap((r) => Object.keys(r)))];
        const vals = this.rows
          .map(
            (r) =>
              "(" +
              cols
                .map((c) => {
                  if (!(c in r)) return "default";
                  params.push(r[c]);
                  return `$${params.length}`;
                })
                .join(", ") +
              ")",
          )
          .join(", ");
        let sql = `insert into ${t} (${cols.map(ident).join(", ")}) values ${vals}`;
        if (this.conflict) {
          sql += ` on conflict (${this.conflict.cols.map(ident).join(", ")}) `;
          sql += this.conflict.ignore
            ? "do nothing"
            : "do update set " + cols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ");
        }
        return { sql: sql + ret, params };
      }
      if (this.op === "update") {
        const sets = Object.entries(this.values).map(([k, v]) => {
          params.push(v);
          return `${ident(k)} = $${params.length}`;
        });
        return { sql: `update ${t} set ${sets.join(", ")}${where()}${ret}`, params };
      }
      return { sql: `delete from ${t}${where()}${ret}`, params };
    }

    then<A, B>(
      ok?: ((v: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null,
      fail?: ((e: unknown) => B | PromiseLike<B>) | null,
    ) {
      const exec = async () => {
        try {
          const { sql, params } = this.build();
          const rows = await run<Record<string, unknown>>(sql, params);
          if (this.mode === "single") {
            if (rows.length !== 1) return { data: null, error: { message: `esperava 1 linha, veio ${rows.length}` } };
            return { data: rows[0], error: null };
          }
          if (this.mode === "maybe") return { data: rows[0] ?? null, error: null };
          const isWrite = this.op !== "select";
          return { data: isWrite && !this.returning ? null : rows, error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      };
      return exec().then(ok, fail);
    }
  }

  return {
    from: (table: string) => new Query(table),
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      try {
        const keys = Object.keys(args);
        const call = `public.${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")})`;
        const [info] = await run<{ retset: boolean }>(
          "select p.proretset as retset from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1",
          [fn],
        );
        if (info?.retset) return { data: await run(`select * from ${call}`, Object.values(args)), error: null };
        const [row] = await run<{ v: unknown }>(`select ${call} as v`, Object.values(args));
        return { data: row?.v ?? null, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
      }
    },
    auth: {
      async getClaims() {
        return { data: { claims: { sub: userId, email } }, error: null };
      },
    },
  };
}
