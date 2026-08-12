import type { Express, RequestHandler } from "express";
import { config } from "./config";

export function installSecurityHeaders(app: Express) {
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://router.project-osrm.org https://*.paypal.com; font-src 'self' data:; frame-src https://*.paypal.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), payment=(self), geolocation=(self)",
    });
    if (config.NODE_ENV === "production") res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
}

// Same-origin cookies plus strict Origin validation protect state-changing API calls.
export const requireTrustedOrigin: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.includes("webhook")) return next();
  const origin = req.get("origin");
  if (!origin && config.NODE_ENV !== "production") return next();
  const expected = config.APP_URL ? new URL(config.APP_URL).origin : `${req.protocol}://${req.get("host")}`;
  if (origin !== expected) return res.status(403).json({ message: "Untrusted request origin" });
  next();
};

export function rateLimit(options: { windowMs: number; limit: number }): RequestHandler {
  const attempts = new Map<string, { count: number; reset: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || "unknown";
    const entry = attempts.get(key);
    if (!entry || entry.reset <= now) {
      attempts.set(key, { count: 1, reset: now + options.windowMs });
      return next();
    }
    entry.count += 1;
    res.set("RateLimit-Remaining", String(Math.max(0, options.limit - entry.count)));
    if (entry.count > options.limit) return res.status(429).json({ message: "Too many requests; try again later" });
    next();
  };
}
