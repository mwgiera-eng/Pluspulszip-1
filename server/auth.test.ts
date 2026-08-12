import assert from "node:assert/strict";
import test from "node:test";
import { loginSchema, registerSchema } from "../shared/auth";

// Config is validated before auth is imported, mirroring production startup.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost/test";
process.env.SESSION_SECRET ??= "test-session-secret-that-is-at-least-32-characters";

test("registration validates and normalizes a strong credential payload", () => {
  const result = registerSchema.parse({ email: "  PERSON@Example.COM ", password: "Production123", displayName: "Person" });
  assert.equal(result.email, "person@example.com");
  assert.equal(result.displayName, "Person");
});

test("registration rejects weak and unknown input", () => {
  assert.throws(() => registerSchema.parse({ email: "bad", password: "password", displayName: "P", role: "admin" }));
});

test("login accepts passwords for verification without applying registration policy", () => {
  assert.equal(loginSchema.parse({ email: "person@example.com", password: "legacy-value" }).email, "person@example.com");
  assert.throws(() => loginSchema.parse({ email: "person@example.com", password: "x", userId: "another-user" }));
});

test("password hashing is salted and verification rejects a wrong password", async () => {
  const { hashPassword, passwordMatches } = await import("./replit_integrations/auth/replitAuth");
  const first = await hashPassword("Production123");
  const second = await hashPassword("Production123");
  assert.notEqual(first, second);
  assert.equal(await passwordMatches("Production123", first), true);
  assert.equal(await passwordMatches("Incorrect123", first), false);
  assert.equal(first.includes("Production123"), false);
});
