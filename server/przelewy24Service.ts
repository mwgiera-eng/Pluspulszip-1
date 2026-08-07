import crypto from "crypto";

const P24_SANDBOX_URL = "https://sandbox.przelewy24.pl";
const P24_PRODUCTION_URL = "https://secure.przelewy24.pl";

interface P24Config {
  merchantId: number;
  posId: number;
  crcKey: string;
  apiKey: string;
  baseUrl: string;
  isSandbox: boolean;
  hasCredentials: boolean;
}

function getConfig(): P24Config {
  const merchantId = process.env.P24_MERCHANT_ID;
  const posId = process.env.P24_POS_ID || merchantId;
  const crcKey = process.env.P24_CRC_KEY;
  const apiKey = process.env.P24_API_KEY;
  const isSandbox = process.env.P24_SANDBOX === "true";
  const hasCredentials = !!(merchantId && crcKey && apiKey);

  return {
    merchantId: merchantId ? parseInt(merchantId) : 0,
    posId: posId ? parseInt(posId) : 0,
    crcKey: crcKey || "",
    apiKey: apiKey || "",
    baseUrl: isSandbox ? P24_SANDBOX_URL : P24_PRODUCTION_URL,
    isSandbox,
    hasCredentials,
  };
}

function generateSessionId(): string {
  return `bo_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
}

function calculateRegistrationSign(
  sessionId: string,
  merchantId: number,
  amount: number,
  currency: string,
  crc: string
): string {
  const data = JSON.stringify({ sessionId, merchantId, amount, currency, crc });
  return crypto.createHash("sha384").update(data).digest("hex");
}

function calculateVerificationSign(
  sessionId: string,
  orderId: number,
  amount: number,
  currency: string,
  crc: string
): string {
  const data = JSON.stringify({ sessionId, orderId, amount, currency, crc });
  return crypto.createHash("sha384").update(data).digest("hex");
}

function getAuthHeader(config: P24Config): string {
  return `Basic ${Buffer.from(`${config.posId}:${config.apiKey}`).toString("base64")}`;
}

function getAppUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return `https://${process.env.REPLIT_DEPLOYMENT_URL}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "https://localhost:5000";
}

export type PaymentMethod = "blik" | "card" | "transfer" | "all";

export interface TransactionRegistration {
  token: string;
  sessionId: string;
  redirectUrl: string | null;
}

export interface P24TransactionResult {
  success: boolean;
  orderId?: number;
  error?: string;
}

export interface WebhookBody {
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  originAmount: number;
  currency: string;
  orderId: number;
  methodId: number;
  statement: string;
  sign: string;
}

function getChannelForMethod(method: PaymentMethod): number | undefined {
  switch (method) {
    case "blik":
      return undefined;
    case "card":
      return 1;
    case "transfer":
      return 2;
    case "all":
      return 63;
    default:
      return 16;
  }
}

export async function registerTransaction(
  userId: string,
  email: string,
  amount: number,
  paymentMethod: PaymentMethod = "blik",
  description: string = "ShiftOptima Premium - 1 month"
): Promise<TransactionRegistration> {
  const config = getConfig();
  const sessionId = generateSessionId();
  const amountInGrosze = Math.round(amount * 100);

  // Fail closed when credentials are missing — even in sandbox mode.
  // Sandbox testing must use real P24 sandbox credentials.
  if (!config.hasCredentials) {
    throw new Error("Payment system not configured. Please contact the administrator.");
  }

  const sign = calculateRegistrationSign(
    sessionId,
    config.merchantId,
    amountInGrosze,
    "PLN",
    config.crcKey
  );

  const appUrl = getAppUrl();

  const body: Record<string, any> = {
    merchantId: config.merchantId,
    posId: config.posId,
    sessionId,
    amount: amountInGrosze,
    currency: "PLN",
    description,
    email,
    country: "PL",
    language: "pl",
    urlReturn: `${appUrl}/subscription?payment=complete&sessionId=${sessionId}`,
    urlStatus: `${appUrl}/api/subscription/webhook`,
    sign,
  };

  if (paymentMethod === "blik") {
    body.method = 150;
  } else {
    const channel = getChannelForMethod(paymentMethod);
    if (channel !== undefined) {
      body.channel = channel;
    }
  }

  const response = await fetch(`${config.baseUrl}/api/v1/transaction/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader(config),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as any;

  if (data.data?.token) {
    const token = data.data.token;
    return {
      token,
      sessionId,
      redirectUrl: paymentMethod !== "blik" ? `${config.baseUrl}/trnRequest/${token}` : null,
    };
  }

  console.error("[P24] Registration failed:", JSON.stringify(data));
  throw new Error(data.error || `P24 registration failed (code: ${data.code || "unknown"})`);
}

export async function processBlikPayment(
  token: string,
  blikCode: string
): Promise<P24TransactionResult> {
  const config = getConfig();

  // Fail closed when credentials are missing — never simulate a successful
  // payment, since that would activate a subscription without any real charge.
  if (!config.hasCredentials) {
    console.warn("[P24] BLIK payment rejected: credentials not configured");
    return { success: false, error: "Payment system not configured" };
  }

  const response = await fetch(`${config.baseUrl}/api/v1/paymentMethod/blik/chargeByCode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader(config),
    },
    body: JSON.stringify({
      token,
      blikCode,
    }),
  });

  const data = await response.json() as any;

  if (response.ok && data.data) {
    return {
      success: true,
      orderId: data.data.orderId,
    };
  }

  console.error("[P24] BLIK charge failed:", JSON.stringify(data));
  return {
    success: false,
    error: data.error || "BLIK payment failed",
  };
}

export function verifyWebhookSignature(body: WebhookBody): boolean {
  const config = getConfig();

  // Never bypass signature verification. Without a CRC key we cannot
  // authenticate the webhook, so reject it. Sandbox testing should use
  // real P24 sandbox credentials (P24_CRC_KEY etc.) instead of a bypass.
  if (!config.crcKey) {
    console.warn("[P24] Webhook rejected: no CRC key configured, cannot verify signature");
    return false;
  }

  if (typeof body.sign !== "string" || body.sign.length === 0) {
    return false;
  }

  const expectedSign = calculateVerificationSign(
    body.sessionId,
    body.orderId,
    body.amount,
    body.currency,
    config.crcKey
  );

  const provided = Buffer.from(body.sign, "utf8");
  const expected = Buffer.from(expectedSign, "utf8");
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export async function verifyTransaction(
  orderId: number,
  sessionId: string,
  amount: number
): Promise<boolean> {
  const config = getConfig();

  // Never bypass verification: without credentials we cannot confirm the
  // transaction with P24, so treat it as unverified.
  if (!config.hasCredentials) {
    console.warn("[P24] Transaction verification rejected: credentials not configured");
    return false;
  }

  const amountInGrosze = Math.round(amount * 100);
  const sign = calculateVerificationSign(
    sessionId,
    orderId,
    amountInGrosze,
    "PLN",
    config.crcKey
  );

  const response = await fetch(`${config.baseUrl}/api/v1/transaction/verify`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader(config),
    },
    body: JSON.stringify({
      merchantId: config.merchantId,
      posId: config.posId,
      sessionId,
      amount: amountInGrosze,
      currency: "PLN",
      orderId,
      sign,
    }),
  });

  const data = await response.json() as any;

  if (response.ok && data.data?.status === "success") {
    return true;
  }

  console.error("[P24] Verification failed:", JSON.stringify(data));
  return false;
}

export function getPaymentPageUrl(token: string): string {
  const config = getConfig();
  return `${config.baseUrl}/trnRequest/${token}`;
}

export function isSandboxMode(): boolean {
  const config = getConfig();
  return config.isSandbox;
}

export function isConfigured(): boolean {
  const config = getConfig();
  // Sandbox mode still requires real (sandbox) P24 credentials to be usable.
  return config.hasCredentials;
}
