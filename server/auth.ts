import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { z } from "zod";
import { loginSchema, registerSchema, passwordSchema } from "@shared/auth";
import { authStorage, sanitizeUser } from "./authStorage";
import { DB_ENABLED, pool } from "./db";
import { getSubscriptionStatus } from "./subscriptionService";

const SESSION_COOKIE = "pluspuls.sid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(limit: number, windowMs: number): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (current.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ message: "Zbyt wiele prób. Spróbuj ponownie później." });
    }
    current.count += 1;
    if (attempts.size > 5000) attempts.clear();
    return next();
  };
}

const loginLimit = rateLimit(10, 15 * 60_000);
const adminLoginLimit = rateLimit(6, 15 * 60_000);
const registerLimit = rateLimit(6, 60 * 60_000);
const deleteAccountLimit = rateLimit(3, 60 * 60_000);

function requireSameOrigin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite === "cross-site") return res.status(403).json({ message: "Cross-site request blocked" });

  const configured = process.env.APP_BASE_URL?.trim();
  const origin = req.get("origin");
  if (configured && origin) {
    try {
      if (new URL(configured).origin !== new URL(origin).origin) {
        return res.status(403).json({ message: "Origin not allowed" });
      }
    } catch {
      return res.status(403).json({ message: "Origin not allowed" });
    }
  }
  return next();
}

function deriveKey(password: string, salt: Buffer, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, length, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  passwordSchema.parse(password);
  const salt = crypto.randomBytes(16);
  const derived = await deriveKey(password, salt, 64);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function passwordMatches(password: string, stored: string): Promise<boolean> {
  try {
    const [algorithm, n, r, p, saltValue, expectedValue] = stored.split("$");
    if (algorithm !== "scrypt" || !saltValue || !expectedValue) return false;
    if (Number(n) !== SCRYPT_OPTIONS.N || Number(r) !== SCRYPT_OPTIONS.r || Number(p) !== SCRYPT_OPTIONS.p) return false;
    const expected = Buffer.from(expectedValue, "base64");
    const actual = await deriveKey(password, Buffer.from(saltValue, "base64"), expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function ensureAuthSchema() {
  if (!pool) throw new Error("DATABASE_URL is required for authentication");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid varchar PRIMARY KEY NOT NULL,
      sess jsonb NOT NULL,
      expire timestamp NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash varchar;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamp;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp;
  `);
}

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured together");

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) throw new Error("ADMIN_EMAIL is invalid or ADMIN_PASSWORD is outside supported length");
  passwordSchema.parse(password);

  const existing = await authStorage.getUserByEmail(email);
  if (existing) {
    if (existing.role !== "admin") {
      console.warn("[Auth] ADMIN_EMAIL belongs to a non-admin account; automatic promotion was refused");
    }
    return;
  }

  await authStorage.createUser({
    email,
    passwordHash: await hashPassword(password),
    firstName: "PlusPuls",
    lastName: "Administrator",
    role: "admin",
    status: "approved",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
  });
  console.log("[Auth] Initial administrator account created; remove ADMIN_PASSWORD from the environment after first successful login");
}

function publicUser(user: any) {
  const safe = sanitizeUser(user);
  const subscriptionInfo = getSubscriptionStatus(user);
  return { ...safe, isPremium: subscriptionInfo.isPremium, subscriptionInfo };
}

function validationResponse(res: import("express").Response, error: unknown) {
  if (!(error instanceof z.ZodError)) return false;
  res.status(400).json({
    message: "Sprawdź dane formularza.",
    issues: error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
  });
  return true;
}

async function verifyCredentials(email: string, password: string) {
  const user = await authStorage.getUserByEmail(email);
  if (!user?.passwordHash) return undefined;
  if (["disabled", "suspended", "rejected"].includes(user.status ?? "")) return undefined;
  if (!(await passwordMatches(password, user.passwordHash))) return undefined;
  return user;
}

function establishSession(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction, user: any, status = 200) {
  req.login({ ...user, claims: { sub: user.id } }, (error) => {
    if (error) return next(error);
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return next(regenerateError);
      req.login({ ...user, claims: { sub: user.id } }, (loginError) => {
        if (loginError) return next(loginError);
        req.session.save((saveError) => {
          if (saveError) return next(saveError);
          return res.status(status).json({ user: publicUser(user) });
        });
      });
    });
  });
}

export async function setupAuth(app: Express) {
  if (!DB_ENABLED) {
    console.warn("[Auth] Authentication disabled because DATABASE_URL is not configured");
    return;
  }

  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  if (process.env.NODE_ENV === "production" && !process.env.APP_BASE_URL) {
    throw new Error("APP_BASE_URL is required in production");
  }

  await ensureAuthSchema();
  await bootstrapAdmin();

  app.set("trust proxy", 1);
  const PgStore = connectPg(session);
  app.use(session({
    name: SESSION_COOKIE,
    secret,
    store: new PgStore({ pool, tableName: "sessions", createTableIfMissing: false, ttl: SESSION_TTL_MS / 1000 }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_MS,
      path: "/",
    },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authStorage.getUser(id);
      done(null, user ? { ...user, claims: { sub: user.id } } : false);
    } catch (error) {
      done(error);
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated?.() || !user?.id) return res.status(401).json({ message: "Unauthorized" });
  if (user.status === "pending") return res.status(403).json({ message: "Account awaiting approval", code: "ACCOUNT_PENDING" });
  if (["disabled", "suspended", "rejected"].includes(user.status ?? "")) {
    return res.status(403).json({ message: "Account unavailable", code: "ACCOUNT_UNAVAILABLE" });
  }
  return next();
};

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/user", async (req, res, next) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Unauthorized" });
      const sessionUser = req.user as any;
      const user = sessionUser?.id ? await authStorage.getUser(sessionUser.id) : undefined;
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      return res.json(publicUser(user));
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/register", requireSameOrigin, registerLimit, async (req, res, next) => {
    try {
      if (!DB_ENABLED) return res.status(503).json({ message: "Registration is temporarily unavailable" });
      const input = registerSchema.parse(req.body);
      if (await authStorage.getUserByEmail(input.email)) {
        return res.status(409).json({ message: "Konto z tym adresem e-mail już istnieje." });
      }

      const now = new Date();
      const user = await authStorage.createUser({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        role: "user",
        status: "pending",
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
      });
      return establishSession(req, res, next, user, 201);
    } catch (error: any) {
      if (validationResponse(res, error)) return;
      if (error?.code === "23505") return res.status(409).json({ message: "Konto z tym adresem e-mail już istnieje." });
      return next(error);
    }
  });

  app.post("/api/login/password", requireSameOrigin, loginLimit, async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await verifyCredentials(input.email, input.password);
      if (!user) return res.status(401).json({ message: "Nieprawidłowy e-mail lub hasło." });
      const currentUser = await authStorage.updateLastLogin(user.id);
      return establishSession(req, res, next, currentUser);
    } catch (error) {
      if (validationResponse(res, error)) return;
      return next(error);
    }
  });

  app.post("/api/admin/login", requireSameOrigin, adminLoginLimit, async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await verifyCredentials(input.email, input.password);
      if (!user || user.role !== "admin" || user.status !== "approved") {
        return res.status(401).json({ message: "Nieprawidłowe dane administratora." });
      }
      const currentUser = await authStorage.updateLastLogin(user.id);
      return establishSession(req, res, next, currentUser);
    } catch (error) {
      if (validationResponse(res, error)) return;
      return next(error);
    }
  });

  app.post("/api/logout", requireSameOrigin, (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session.destroy((destroyError) => {
        if (destroyError) return next(destroyError);
        res.clearCookie(SESSION_COOKIE, { path: "/" });
        return res.status(204).end();
      });
    });
  });

  app.delete("/api/account", requireSameOrigin, deleteAccountLimit, async (req, res, next) => {
    try {
      if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Unauthorized" });
      const sessionUser = req.user as any;
      const user = sessionUser?.id ? await authStorage.getUser(sessionUser.id) : undefined;
      if (!user?.email) return res.status(401).json({ message: "Unauthorized" });
      if (user.role === "admin") return res.status(403).json({ message: "Administrator accounts require an ownership transfer process." });

      const confirmation = z.object({ password: z.string().min(1).max(128), confirmation: z.literal("DELETE") }).strict().parse(req.body);
      if (!user.passwordHash || !(await passwordMatches(confirmation.password, user.passwordHash))) {
        return res.status(401).json({ message: "Nieprawidłowe hasło." });
      }

      const dbPool = pool;
      if (!DB_ENABLED || !dbPool) return res.status(503).json({ message: "Account deletion is temporarily unavailable." });
      const client = await dbPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM recommendation_outcomes WHERE recommendation_id IN (SELECT id FROM copilot_recommendations WHERE user_id = $1)", [user.id]);
        await client.query("DELETE FROM replay_events WHERE shift_session_id IN (SELECT id FROM shift_sessions WHERE user_id = $1)", [user.id]);
        await client.query("DELETE FROM copilot_recommendations WHERE user_id = $1", [user.id]);
        await client.query("DELETE FROM shift_sessions WHERE user_id = $1", [user.id]);
        await client.query("DELETE FROM driver_insights WHERE user_id = $1", [user.id]);
        await client.query("DELETE FROM notification_preferences WHERE user_id = $1", [user.id]);
        await client.query("DELETE FROM earnings WHERE user_id = $1", [user.id]);
        await client.query("DELETE FROM payments WHERE user_id = $1", [user.id]);
        const trustTable = await client.query<{ name: string | null }>("SELECT to_regclass('public.trust_reports')::text AS name");
        if (trustTable.rows[0]?.name) await client.query("DELETE FROM trust_reports WHERE lower(contact_email) = lower($1)", [user.email]);
        await client.query("DELETE FROM sessions WHERE sess->'passport'->>'user' = $1", [user.id]);
        await client.query("DELETE FROM users WHERE id = $1", [user.id]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      req.session.destroy((destroyError) => {
        if (destroyError) return next(destroyError);
        res.clearCookie(SESSION_COOKIE, { path: "/" });
        return res.status(204).end();
      });
    } catch (error) {
      if (validationResponse(res, error)) return;
      return next(error);
    }
  });

  app.get("/api/logout", (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session.destroy((destroyError) => {
        if (destroyError) return next(destroyError);
        res.clearCookie(SESSION_COOKIE, { path: "/" });
        return res.redirect("/login");
      });
    });
  });

  app.get("/api/login", (_req, res) => res.redirect("/login"));
}

export { authStorage };
