import { emailVerificationTokens, passwordResetTokens, users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { and, eq, gt, isNull, sql, gte } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPhone(userId: string, phone: string): Promise<User>;
  updateUserStatus(userId: string, status: string): Promise<User>;
  updateAccountType(userId: string, accountType: string, companyName?: string): Promise<User>;
  updateHeartbeat(userId: string, lat?: number, lng?: number): Promise<void>;
  getActiveUsers(windowMinutes: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getPendingUsers(): Promise<User[]>;
  getUserCount(): Promise<number>;
  updateLastLogin(userId: string): Promise<User>;
  createToken(kind: "verification" | "reset", userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumeToken(kind: "verification" | "reset", tokenHash: string): Promise<User | undefined>;
  replacePassword(userId: string, passwordHash: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...userData, status: userData.status ?? "pending" })
      .returning();
    return user;
  }

  async updateUserPhone(userId: string, phone: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ phoneNumber: phone, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserStatus(userId: string, status: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateAccountType(userId: string, accountType: string, companyName?: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ accountType, companyName: companyName ?? null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateHeartbeat(userId: string, lat?: number, lng?: number): Promise<void> {
    const update = lat !== undefined && lng !== undefined
      ? { lastSeenAt: new Date(), lastSeenLat: String(lat), lastSeenLng: String(lng) }
      : { lastSeenAt: new Date() };
    await db.update(users).set(update).where(eq(users.id, userId));
  }

  async getActiveUsers(windowMinutes: number): Promise<User[]> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return await db
      .select()
      .from(users)
      .where(gte(users.lastSeenAt, cutoff))
      .orderBy(users.lastSeenAt);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async getPendingUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.status, "pending")).orderBy(users.createdAt);
  }

  async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0]?.count) || 0;
  }

  async updateLastLogin(userId: string): Promise<User> {
    const [user] = await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId)).returning();
    return user;
  }

  async createToken(kind: "verification" | "reset", userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const table = kind === "verification" ? emailVerificationTokens : passwordResetTokens;
    await db.transaction(async (tx) => {
      await tx.delete(table).where(eq(table.userId, userId));
      await tx.insert(table).values({ userId, tokenHash, expiresAt });
    });
  }

  async consumeToken(kind: "verification" | "reset", tokenHash: string): Promise<User | undefined> {
    const table = kind === "verification" ? emailVerificationTokens : passwordResetTokens;
    return db.transaction(async (tx) => {
      const [token] = await tx.select().from(table).where(and(eq(table.tokenHash, tokenHash), isNull(table.usedAt), gt(table.expiresAt, new Date()))).for("update");
      if (!token) return undefined;
      await tx.update(table).set({ usedAt: new Date() }).where(eq(table.id, token.id));
      const [user] = kind === "verification"
        ? await tx.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, token.userId)).returning()
        : await tx.select().from(users).where(eq(users.id, token.userId));
      return user;
    });
  }

  async replacePassword(userId: string, passwordHash: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    });
  }
}

export const authStorage = new AuthStorage();
