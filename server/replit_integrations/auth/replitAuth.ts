import crypto from "node:crypto";
import passport from "passport";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { config } from "../../config";
import { deliverAccountEmail } from "../../email";
import { rateLimit } from "../../security";
import { emailSchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema, type PublicUser } from "@shared/auth";
import type { User } from "@shared/models/auth";
import { authStorage } from "./storage";

export type AuthenticatedUser = User & { claims: { sub: string } };

const deriveKey = (password: string, salt: Buffer, length: number, options: crypto.ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => crypto.scrypt(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key)));
const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10 });
const recoveryLimit = rateLimit({ windowMs: 60 * 60_000, limit: 5 });

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: user.displayName ?? [user.firstName, user.lastName].filter(Boolean).join(" "),
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role === "admin" ? "admin" : "user",
    status: user.status ?? "pending",
    emailVerified: user.emailVerified,
    accountType: user.accountType,
    subscriptionStatus: user.subscriptionStatus,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derived = await deriveKey(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function passwordMatches(password: string, stored: string) {
  const [algorithm, n, r, p, saltValue, expectedValue] = stored.split("$");
  if (algorithm !== "scrypt" || !saltValue || !expectedValue) return false;
  const expected = Buffer.from(expectedValue, "base64");
  const actual = await deriveKey(password, Buffer.from(saltValue, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const makeToken = () => crypto.randomBytes(32).toString("base64url");
const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

async function sendAccountEmail(message: Parameters<typeof deliverAccountEmail>[0]) {
  try {
    await deliverAccountEmail(message);
  } catch (error) {
    console.error("Account email delivery failed", { name: error instanceof Error ? error.name : "UnknownError" });
  }
}

export function getSession() {
  const PgStore = connectPg(session);
  return session({
    secret: config.SESSION_SECRET,
    store: new PgStore({ conString: config.DATABASE_URL, createTableIfMissing: false, ttl: 7 * 24 * 60 * 60, tableName: "sessions" }),
    name: "shiftoptima.sid",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 },
  });
}

function respondValidation(res: import("express").Response, error: unknown) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: "Invalid request", issues: error.issues.map(({ path, message }) => ({ path, message })) });
    return true;
  }
  return false;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authStorage.getUser(id);
      done(null, user ? { ...user, claims: { sub: user.id } } : false);
    } catch (error) { done(error); }
  });

  app.post("/api/auth/register", authLimit, async (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      if (await authStorage.getUserByEmail(input.email)) return res.status(409).json({ message: "An account with this email already exists" });
      const displayName = input.displayName ?? `${input.firstName} ${input.lastName}`;
      const user = await authStorage.upsertUser({
        email: input.email, passwordHash: await hashPassword(input.password), displayName,
        firstName: input.firstName ?? displayName.split(" ")[0], lastName: input.lastName ?? null,
        role: "user", status: "pending", emailVerified: false,
      });
      const verificationToken = makeToken();
      await authStorage.createToken("verification", user.id, tokenHash(verificationToken), new Date(Date.now() + 24 * 60 * 60_000));
      await sendAccountEmail({ to: input.email, kind: "verify", token: verificationToken });
      req.login({ ...user, claims: { sub: user.id } }, (error) => error ? next(error) : res.status(201).json({ user: toPublicUser(user) }));
    } catch (error) { if (!respondValidation(res, error)) next(error); }
  });

  app.post("/api/auth/login", authLimit, async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await authStorage.getUserByEmail(input.email);
      if (!user?.passwordHash || !["pending", "approved", "active"].includes(user.status ?? "") || !(await passwordMatches(input.password, user.passwordHash))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const currentUser = await authStorage.updateLastLogin(user.id);
      req.login({ ...currentUser, claims: { sub: currentUser.id } }, (error) => error ? next(error) : res.json({ user: toPublicUser(currentUser) }));
    } catch (error) { if (respondValidation(res, error)) return; next(error); }
  });

  app.post("/api/auth/logout", (req, res, next) => req.logout((error) => {
    if (error) return next(error);
    req.session.destroy((destroyError) => destroyError ? next(destroyError) : res.clearCookie("shiftoptima.sid").status(204).end());
  }));

  app.post("/api/auth/forgot-password", recoveryLimit, async (req, res, next) => {
    try {
      const { email } = emailSchema.parse(req.body);
      const user = await authStorage.getUserByEmail(email);
      if (user) {
        const token = makeToken();
        await authStorage.createToken("reset", user.id, tokenHash(token), new Date(Date.now() + 60 * 60_000));
        await sendAccountEmail({ to: email, kind: "reset", token });
      }
      res.json({ message: "If the account exists, password reset instructions will be sent" });
    } catch (error) { if (!respondValidation(res, error)) next(error); }
  });

  app.post("/api/auth/reset-password", recoveryLimit, async (req, res, next) => {
    try {
      const input = resetPasswordSchema.parse(req.body);
      const user = await authStorage.consumeToken("reset", tokenHash(input.token));
      if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });
      await authStorage.replacePassword(user.id, await hashPassword(input.password));
      res.json({ message: "Password updated" });
    } catch (error) { if (!respondValidation(res, error)) next(error); }
  });

  app.post("/api/auth/verify-email", recoveryLimit, async (req, res, next) => {
    try {
      const { token } = tokenSchema.parse(req.body);
      const user = await authStorage.consumeToken("verification", tokenHash(token));
      if (!user) return res.status(400).json({ message: "Invalid or expired verification token" });
      res.json({ user: toPublicUser(user) });
    } catch (error) { if (!respondValidation(res, error)) next(error); }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = req.user as AuthenticatedUser | undefined;
  if (!req.isAuthenticated() || !user?.id) return res.status(401).json({ message: "Unauthorized" });
  if (["disabled", "suspended", "rejected"].includes(user.status ?? "")) return res.status(403).json({ message: "Account unavailable" });
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user?.id) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
