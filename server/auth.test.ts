import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema, registerSchema } from "../shared/auth";
import { hashPassword, passwordMatches } from "./auth";

test("registration normalizes email and requires explicit legal acceptance", () => {
  const parsed = registerSchema.parse({
    firstName: " Jan ",
    lastName: " Kowalski ",
    email: " DRIVER@Example.COM ",
    password: "SecurePass123",
    termsAccepted: true,
    privacyAccepted: true,
  });
  assert.equal(parsed.email, "driver@example.com");
  assert.equal(parsed.firstName, "Jan");
  assert.equal(parsed.lastName, "Kowalski");
});

test("registration rejects weak passwords, missing consent, and role injection", () => {
  assert.throws(() => registerSchema.parse({
    firstName: "Jan",
    lastName: "Kowalski",
    email: "driver@example.com",
    password: "password",
    termsAccepted: true,
    privacyAccepted: true,
  }));

  assert.throws(() => registerSchema.parse({
    firstName: "Jan",
    lastName: "Kowalski",
    email: "driver@example.com",
    password: "SecurePass123",
    termsAccepted: true,
    privacyAccepted: false,
  }));

  assert.throws(() => registerSchema.parse({
    firstName: "Jan",
    lastName: "Kowalski",
    email: "driver@example.com",
    password: "SecurePass123",
    termsAccepted: true,
    privacyAccepted: true,
    role: "admin",
  }));
});

test("login schema accepts credentials but rejects unexpected identity fields", () => {
  assert.equal(loginSchema.parse({ email: "ADMIN@Example.COM", password: "existing-password" }).email, "admin@example.com");
  assert.throws(() => loginSchema.parse({ email: "admin@example.com", password: "existing-password", userId: "other-user" }));
});

test("password hashes are salted and timing-safe verification rejects a wrong password", async () => {
  const first = await hashPassword("SecurePass123");
  const second = await hashPassword("SecurePass123");
  assert.notEqual(first, second);
  assert.equal(first.includes("SecurePass123"), false);
  assert.equal(await passwordMatches("SecurePass123", first), true);
  assert.equal(await passwordMatches("WrongPass123", first), false);
});
