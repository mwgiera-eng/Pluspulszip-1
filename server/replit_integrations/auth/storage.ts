import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql, gte } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPhone(userId: string, phone: string): Promise<User>;
  updateUserStatus(userId: string, status: string): Promise<User>;
  updateAccountType(userId: string, accountType: string, companyName?: string): Promise<User>;
  updateHeartbeat(userId: string, lat?: number, lng?: number): Promise<void>;
  getActiveUsers(windowMinutes: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getPendingUsers(): Promise<User[]>;
  getUserCount(): Promise<number>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const updateSet: Record<string, any> = {
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      updatedAt: new Date(),
    };
    updateSet.role = userData.role ?? "user";
    updateSet.status = userData.status ?? "pending";
    const [user] = await db
      .insert(users)
      .values({ ...userData, status: userData.status ?? "pending" })
      .onConflictDoUpdate({
        target: users.id,
        set: updateSet,
      })
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
    const update: Record<string, any> = { lastSeenAt: new Date() };
    if (lat !== undefined && lng !== undefined) {
      update.lastSeenLat = String(lat);
      update.lastSeenLng = String(lng);
    }
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
}

export const authStorage = new AuthStorage();

/** Strip sensitive fields before sending a user object to any client. */
export function sanitizeUser<T extends { passwordHash?: string | null }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash, ...safe } = user;
  return safe;
}

