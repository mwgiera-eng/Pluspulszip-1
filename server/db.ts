import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

export let pool: any = null;
export let db: any = null;
export const DB_ENABLED = Boolean(process.env.DATABASE_URL);

if (!DB_ENABLED) {
  // During local dev in ephemeral environments (or CI without a DB), allow the app to start
  // but export a stubbed `db` object so imports don't throw. Database-backed features will
  // throw at runtime if invoked. For production deploys, ensure DATABASE_URL is set.
  console.warn("DATABASE_URL not set — database features are disabled. Set DATABASE_URL to enable DB.");

  // Minimal stub to satisfy imports. Each method throws if used so callers get a clear error.
  const throwing = () => { throw new Error("Database not initialized. Set DATABASE_URL to enable DB features."); };
  const dbStub: any = new Proxy({}, {
    get: (_target, prop) => {
      return throwing;
    }
  });

  pool = null;
  db = dbStub;
} else {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}
