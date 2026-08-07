import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

const ADMIN_EMAIL = "obeydefiance@icloud.com";

// ── Session ───────────────────────────────────────────────────────────────────

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

// ── User upsert ───────────────────────────────────────────────────────────────

async function upsertUserFromGoogle(profile: Profile) {
  const email = profile.emails?.[0]?.value ?? null;
  const isAdminUser =
    (process.env.ADMIN_USER_ID && profile.id === process.env.ADMIN_USER_ID) ||
    (email !== null && email === ADMIN_EMAIL);

  await authStorage.upsertUser({
    id: profile.id,
    email: email ?? undefined,
    firstName: profile.name?.givenName,
    lastName: profile.name?.familyName,
    profileImageUrl: profile.photos?.[0]?.value,
    role: isAdminUser ? "admin" : "user",
    status: "approved",
  });
}

// ── Auth setup ────────────────────────────────────────────────────────────────

export async function setupAuth(app: Express) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn(
      "[Auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — " +
        "Google login will not work until these secrets are added."
    );
  }

  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID ?? "MISSING",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "MISSING",
        // Use env var for flexibility across dev / prod domains.
        // Register this exact URL in Google Cloud Console → OAuth credentials.
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ?? "/api/callback",
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          await upsertUserFromGoogle(profile);
          const user = await authStorage.getUser(profile.id);
          done(null, user ?? false);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  // Store only the user's DB id in the session; re-fetch on each request.
  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authStorage.getUser(id);
      done(null, user ?? false);
    } catch (err) {
      done(err as Error);
    }
  });

  // ── Routes ─────────────────────────────────────────────────────────────────

  app.get(
    "/api/login",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/callback",
    passport.authenticate("google", {
      failureRedirect: "/login?error=auth_failed",
    }),
    (_req, res) => res.redirect("/")
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });
}

// ── Middleware ────────────────────────────────────────────────────────────────

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};
