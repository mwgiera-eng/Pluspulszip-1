import type { Express, RequestHandler } from "express";
import { authStorage } from "./authStorage";

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

export function registerAuthRoutes(_app: Express) {
  // Login/logout routes must only be registered with verified production auth.
}

export { authStorage };
