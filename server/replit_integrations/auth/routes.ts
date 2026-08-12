import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { getSubscriptionStatus } from "../../subscriptionService";

function publicUser(user: Awaited<ReturnType<typeof authStorage.getUser>>) {
  if (!user) return user;
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const sub = getSubscriptionStatus(user);
      res.json({
        ...publicUser(user),
        isPremium: sub.isPremium,
        subscriptionInfo: sub,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
