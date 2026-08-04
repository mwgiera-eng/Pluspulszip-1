import type { Express, RequestHandler } from "express";
import { authStorage } from "./authStorage";

// Minimal GCP-friendly auth shim.
// - setupAuth: no-op (session-based Replit OIDC removed)
// - isAuthenticated: checks X-User-Id header or Authorization: Bearer <userId>
// - registerAuthRoutes: no-op placeholder

export async function setupAuth(_app: Express) {
  // No session or Replit-specific setup here. Trust proxy for GCP if necessary.
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // If an existing session middleware is present and authenticated, allow through
  try {
    // Prefer existing passport/session style if available
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof req.isAuthenticated === "function" && (req as any).isAuthenticated()) {
      return next();
    }
  } catch (e) {
    // ignore
  }

  const authHeader = (req.headers["authorization"] as string) || (req.headers["x-user-id"] as string);
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

  let userId = authHeader;
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    userId = authHeader.slice(7).trim();
  }

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await authStorage.getUser(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  // attach a minimal user.claims object expected by existing code
  (req as any).user = { claims: { sub: user.id }, ...user };
  return next();
};

export function registerAuthRoutes(_app: Express) {
  // No login/logout endpoints provided here. Use GCP IAM / proxy-based auth or implement OIDC separately.
}

export { authStorage };
