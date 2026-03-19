import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import type { User } from "@shared/models/auth";

const TRIAL_DAYS = 21;
const SUBSCRIPTION_PRICE_PLN = 9.99;

export interface SubscriptionInfo {
  status: "trial" | "active" | "expired" | "cancelled";
  isPremium: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  subscriptionExpiresAt: string | null;
  subscriptionDaysLeft: number | null;
  price: number;
  currency: string;
}

export function getSubscriptionStatus(user: User): SubscriptionInfo {
  if (user.role === "admin") {
    return {
      status: "active",
      isPremium: true,
      trialEndsAt: null,
      trialDaysLeft: null,
      subscriptionExpiresAt: null,
      subscriptionDaysLeft: null,
      price: SUBSCRIPTION_PRICE_PLN,
      currency: "PLN",
    };
  }

  const now = new Date();

  if (user.subscriptionStatus === "active" && user.subscriptionExpiresAt) {
    const expiresAt = new Date(user.subscriptionExpiresAt);
    if (expiresAt > now) {
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: "active",
        isPremium: true,
        trialEndsAt: null,
        trialDaysLeft: null,
        subscriptionExpiresAt: expiresAt.toISOString(),
        subscriptionDaysLeft: daysLeft,
        price: SUBSCRIPTION_PRICE_PLN,
        currency: "PLN",
      };
    }
  }

  const trialStart = user.trialStartDate ? new Date(user.trialStartDate) : (user.createdAt ? new Date(user.createdAt) : now);
  const trialEnd = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  if (trialEnd > now) {
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: "trial",
      isPremium: true,
      trialEndsAt: trialEnd.toISOString(),
      trialDaysLeft: daysLeft,
      subscriptionExpiresAt: null,
      subscriptionDaysLeft: null,
      price: SUBSCRIPTION_PRICE_PLN,
      currency: "PLN",
    };
  }

  return {
    status: "expired",
    isPremium: false,
    trialEndsAt: trialEnd.toISOString(),
    trialDaysLeft: 0,
    subscriptionExpiresAt: null,
    subscriptionDaysLeft: null,
    price: SUBSCRIPTION_PRICE_PLN,
    currency: "PLN",
  };
}

export function isFeatureUnlocked(user: User, _feature: string): boolean {
  const sub = getSubscriptionStatus(user);
  return sub.isPremium;
}

export async function activateSubscription(userId: string, months: number = 1): Promise<User> {
  const now = new Date();
  const [existingUser] = await db.select().from(users).where(eq(users.id, userId));

  let startDate = now;
  if (existingUser?.subscriptionStatus === "active" && existingUser.subscriptionExpiresAt) {
    const currentExpiry = new Date(existingUser.subscriptionExpiresAt);
    if (currentExpiry > now) {
      startDate = currentExpiry;
    }
  }

  const expiresAt = new Date(startDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(users)
    .set({
      subscriptionStatus: "active",
      subscriptionExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return updated;
}

export async function checkExpiredSubscriptions(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(users)
    .set({ subscriptionStatus: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(users.subscriptionStatus, "active"),
        isNotNull(users.subscriptionExpiresAt),
        lte(users.subscriptionExpiresAt, now)
      )
    )
    .returning();

  return result.length;
}
