import type { Express, RequestHandler } from "express";
import { authStorage, sanitizeUser } from "./authStorage";
import { getSubscriptionStatus } from "./subscriptionService";

/**
 * Authentication is intentionally fail-closed until a production identity
 * provider is configured.
 *
 * Never trust X-User-Id or an unverified bearer value: both are controlled by
 * the caller and allow account impersonation.
 */
export async function setupAuth(_app: Express) {
  // Install verified session/JWT middleware here before enabling protected routes.
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  try {
    if (typeof req.isAuthenticated === "function" && req.isAuthenticated()) {
      const user = req.user as any;
      if (user?.claims?.sub) {
        return next();
      }
    }
  } catch {
    // Authentication failures must fall through to the fail-closed response.
  }

  return res.status(503).json({
    message: "Authentication is not configured",
    code: "AUTH_NOT_CONFIGURED",
  });
};

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/user", async (req, res, next) => {
    try {
      if (!(typeof req.isAuthenticated === "function" && req.isAuthenticated())) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const sessionUser = req.user as any;
      const userId = sessionUser?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const subscriptionInfo = getSubscriptionStatus(user);
      return res.json({
        ...sanitizeUser(user),
        isPremium: subscriptionInfo.isPremium,
        subscriptionInfo,
      });
    } catch (err) {
      return next(err);
    }
  });

  app.get("/api/login", (_req, res) => {
    res.status(503).json({
      message: "Authentication is not configured",
      code: "AUTH_NOT_CONFIGURED",
    });
  });

  app.post("/api/login/password", (_req, res) => {
    res.status(503).json({
      message: "Authentication is not configured",
      code: "AUTH_NOT_CONFIGURED",
    });
  });

  app.post("/api/register", (_req, res) => {
    res.status(503).json({
      message: "Authentication is not configured",
      code: "AUTH_NOT_CONFIGURED",
    });
  });

  app.get("/api/logout", (req, res) => {
    if (typeof req.logout === "function") {
      req.logout(() => res.redirect("/login"));
      return;
    }
    res.redirect("/login");
  });
}

export { authStorage };
