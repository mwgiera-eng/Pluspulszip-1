import { z } from "zod";

export const passwordSchema = z.string().min(10, "Password must contain at least 10 characters").max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

export const registerSchema = loginSchema.extend({
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(160).optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
}).strict().refine((value) => value.displayName || (value.firstName && value.lastName), {
  message: "Display name or first and last name are required",
});

export const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();
export const tokenSchema = z.object({ token: z.string().min(40).max(200) }).strict();
export const resetPasswordSchema = tokenSchema.extend({ password: passwordSchema }).strict();

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  role: "user" | "admin";
  status: string;
  emailVerified: boolean;
  accountType: string | null;
  subscriptionStatus: string | null;
  createdAt: Date | null;
  lastLoginAt: Date | null;
};
