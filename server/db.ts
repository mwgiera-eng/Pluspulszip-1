import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { config } from "./config";

const { Pool } = pg;

// Render's Blueprint DATABASE_URL resolves to the private/internal Postgres URL,
// which does not require TLS. For external database URLs, node-postgres will
// honor SSL options such as ?sslmode=require directly from the connection URL.
// Do not force certificate verification here: doing so breaks Render's internal
// database connection with DEPTH_ZERO_SELF_SIGNED_CERT.
export const pool = new Pool({ connectionString: config.DATABASE_URL });
export const db = drizzle(pool, { schema });
