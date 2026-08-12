import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { config } from "./config";

const { Pool } = pg;

function createDatabasePool() {
  const databaseUrl = new URL(config.DATABASE_URL);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname);

  // node-postgres lets SSL query-string options override the explicit `ssl`
  // object. Remove only those SSL transport options so Render uses the
  // configuration below consistently, without changing any credentials or
  // other connection parameters.
  for (const parameter of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    databaseUrl.searchParams.delete(parameter);
  }

  return new Pool({
    connectionString: databaseUrl.toString(),
    max: 10,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
}

export const pool = createDatabasePool();
export const db = drizzle(pool, { schema });
