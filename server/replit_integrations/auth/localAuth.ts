import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import type { Express } from "express";
import { z } from "zod";
import { db } from "../../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { authStorage } from "./storage";

const scryptAsync = promisify(scrypt);

// Constant dummy hash used to equalize login timing for unknown emails
const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

// ── Password hashing (scrypt, no external deps) ──────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return buf.length === expected.length && timingSafeEqual(buf, expected);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user;
}

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Podaj imię").max(60),
  lastName: z.string().trim().min(1, "Podaj nazwisko").max(60),
  email: z.string().trim().toLowerCase().email("Nieprawidłowy adres e-mail"),
  password: z.string().min(8, "Hasło musi mieć minimum 8 znaków").max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// ── Setup ─────────────────────────────────────────────────────────────────────

export function setupLocalAuth(app: Express) {
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await getUserByEmail(email);
          if (!user || !user.passwordHash) {
            // Equalize timing with a dummy verification to prevent account enumeration
            await verifyPassword(password, DUMMY_HASH);
            return done(null, false, { message: "Nieprawidłowy e-mail lub hasło" });
          }
          const ok = await verifyPassword(password, user.passwordHash);
          if (!ok) {
            return done(null, false, { message: "Nieprawidłowy e-mail lub hasło" });
          }
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // Register — creates account and logs in immediately
  app.post("/api/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane" });
    }
    const { firstName, lastName, email, password } = parsed.data;

    try {
      const existing = await getUserByEmail(email);
      if (existing) {
        return res.status(409).json({
          message: existing.passwordHash
            ? "Konto z tym adresem już istnieje — zaloguj się."
            : "To konto używa logowania Google — użyj przycisku Google.",
        });
      }

      const passwordHash = await hashPassword(password);
      const [user] = await db
        .insert(users)
        .values({ email, firstName, lastName, passwordHash, status: "approved" })
        .returning();

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Rejestracja powiodła się, ale logowanie nie — spróbuj się zalogować." });
        res.status(201).json({ id: user.id, email: user.email, firstName: user.firstName });
      });
    } catch (err) {
      console.error("[Auth] register failed:", err);
      res.status(500).json({ message: "Nie udało się utworzyć konta. Spróbuj ponownie." });
    }
  });

  // Login with email + password
  app.post("/api/login/password", (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Podaj e-mail i hasło" });
    }
    req.body = parsed.data;
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info?: { message?: string }) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message ?? "Nieprawidłowy e-mail lub hasło" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.json({ ok: true });
      });
    })(req, res, next);
  });
}
