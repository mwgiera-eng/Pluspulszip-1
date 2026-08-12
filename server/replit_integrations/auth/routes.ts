import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated, toPublicUser, type AuthenticatedUser } from "./replitAuth";
import { getSubscriptionStatus } from "../../subscriptionService";

export function registerAuthRoutes(app: Express): void {
  const currentUser = async (req: import("express").Request, res: import("express").Response) => {
    try {
      const userId = (req.user as AuthenticatedUser).id;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const sub = getSubscriptionStatus(user);
      res.json({
        ...toPublicUser(user),
        isPremium: sub.isPremium,
        subscriptionInfo: sub,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  };
  app.get("/api/auth/me", isAuthenticated, currentUser);
  // Compatibility alias for older clients; identity still comes exclusively from the session.
  app.get("/api/auth/user", isAuthenticated, currentUser);
}
