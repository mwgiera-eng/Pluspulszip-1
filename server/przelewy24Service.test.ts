// Targeted security tests for the P24 service fail-closed behavior.
// Run with: npx tsx server/przelewy24Service.test.ts
import assert from "assert";

delete process.env.P24_MERCHANT_ID;
delete process.env.P24_POS_ID;
delete process.env.P24_CRC_KEY;
delete process.env.P24_API_KEY;
process.env.P24_SANDBOX = "true";

const svc = await import("./przelewy24Service");

// 1. Webhook signature must be rejected without a CRC key (no sandbox bypass).
assert.strictEqual(
  svc.verifyWebhookSignature({
    merchantId: 1, posId: 1, sessionId: "bo_x", amount: 999, originAmount: 999,
    currency: "PLN", orderId: 1, methodId: 150, statement: "x", sign: "forged",
  }),
  false,
  "webhook signature must fail without CRC key"
);

// 2. Transaction verification must fail closed without credentials.
assert.strictEqual(await svc.verifyTransaction(1, "bo_x", 9.99), false,
  "verifyTransaction must fail without credentials");

// 3. BLIK payment must not simulate success without credentials.
const blik = await svc.processBlikPayment("token", "123456");
assert.strictEqual(blik.success, false, "BLIK must fail without credentials");

// 4. Transaction registration must throw without credentials (even in sandbox).
await assert.rejects(() => svc.registerTransaction("u1", "u@x.pl", 9.99, "blik"),
  "registerTransaction must throw without credentials");

// 5. isConfigured must be false without credentials, even in sandbox mode.
assert.strictEqual(svc.isConfigured(), false, "isConfigured must require credentials");

console.log("All P24 fail-closed security tests passed.");
