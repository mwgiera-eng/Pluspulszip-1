import crypto from "node:crypto";
import { promisify } from "node:util";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { authStorage } from "./storage";

const scrypt = promisify(crypto.scrypt);
const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
});
const registerSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

function sessionUser(id: string) {
  return { claims: { sub: id }, expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 };
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function passwordMatches(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function getSession() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  const PgStore = connectPg(session);
  return session({
    secret,
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: 7 * 24 * 60 * 60 * 1000,
      tableName: "sessions",
    }),
    name: "shiftoptima.sid",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user: Express.User, done) => done(null, user));

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      if (await authStorage.getUserByEmail(input.email)) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const isAdmin = !!adminEmail && input.email === adminEmail;
      const user = await authStorage.upsertUser({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        role: isAdmin ? "admin" : "user",
        status: isAdmin ? "approved" : "pending",
      });
      req.login(sessionUser(user.id), (error) => {
        if (error) return next(error);
        res.status(201).json({ ok: true });
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });
      next(error);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const input = credentialsSchema.parse(req.body);
      const user = await authStorage.getUserByEmail(input.email);
      if (!user?.passwordHash || !(await passwordMatches(input.password, user.passwordHash))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.login(sessionUser(user.id), (error) => {
        if (error) return next(error);
        res.json({ ok: true });
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Enter a valid email and password" });
      next(error);
    }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session.destroy(() => res.status(204).end());
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = req.user as { claims?: { sub?: string }; expires_at?: number } | undefined;
  if (!req.isAuthenticated() || !user?.claims?.sub || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (user.expires_at < Math.floor(Date.now() / 1000)) {
    return req.logout(() => res.status(401).json({ message: "Session expired" }));
  }
  next();
};
