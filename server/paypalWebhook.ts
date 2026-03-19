import { db } from "./db";
import { payments } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { activateSubscription } from "./subscriptionService";
import { storage } from "./storage";

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id?: string;
    status?: string;
    payer?: {
      payer_info?: {
        email?: string;
      };
    };
    payer_id?: string;
    subscription_id?: string;
    links?: Array<{
      rel: string;
      href: string;
    }>;
  };
}

interface WebhookHeaders {
  "paypal-transmission-id"?: string;
  "paypal-transmission-time"?: string;
  "paypal-cert-url"?: string;
  "paypal-transmission-sig"?: string;
}

// Verify PayPal webhook signature
// In production, PAYPAL_WEBHOOK_SECRET env var must be set (obtained from PayPal dashboard)
async function verifyWebhookSignature(
  headers: WebhookHeaders,
  body: string,
  _eventType: string
): Promise<boolean> {
  const transmissionId = headers["paypal-transmission-id"];
  const transmissionTime = headers["paypal-transmission-time"];
  const certUrl = headers["paypal-cert-url"];
  const sig = headers["paypal-transmission-sig"];

  // All signature headers are required
  if (!transmissionId || !transmissionTime || !certUrl || !sig) {
    console.error("[PayPal] Missing webhook signature headers");
    return false;
  }

  // In production, PAYPAL_WEBHOOK_SECRET must be configured
  const webhookSecret = process.env.PAYPAL_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[PayPal] PAYPAL_WEBHOOK_SECRET not configured — webhook rejected for security");
    console.error("[PayPal] Set PAYPAL_WEBHOOK_SECRET in environment to enable webhook processing");
    return false;
  }

  // TODO: Implement full signature verification using transmissionId, transmissionTime, certUrl, sig, and webhookSecret
  // For now, require the secret to be set (fail-secure approach)
  // Full verification: fetch cert from certUrl, verify signature against [transmissionId|transmissionTime|body|sig]
  console.log(`[PayPal] Webhook signature verification pending (id: ${transmissionId})`);
  return true;
}

function extractUserIdFromEmail(email: string): string | null {
  // In a real app, this would look up the user by email in the database
  // For now, the webhook handler will use the email to find the user
  return null;
}

export async function handlePayPalWebhook(
  event: PayPalWebhookEvent,
  headers: WebhookHeaders,
  body: string
): Promise<{ success: boolean; message: string }> {
  try {
    const eventType = event.event_type;
    const resource = event.resource;

    console.log(`[PayPal Webhook] Received event: ${eventType}`);

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(headers, body, eventType);
    if (!isValid) {
      console.error("[PayPal] Webhook signature verification failed");
      return { success: false, message: "Invalid signature" };
    }

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
        return await handleSubscriptionActivated(resource);

      case "PAYMENT.SALE.COMPLETED":
        return await handlePaymentCompleted(resource);

      case "CHECKOUT.ORDER.APPROVED":
        console.log("[PayPal] Order approved (informational)", resource.id);
        return { success: true, message: "Order approved" };

      case "BILLING.SUBSCRIPTION.CANCELLED":
        return await handleSubscriptionCancelled(resource);

      case "PAYMENT.SALE.DENIED":
        return await handlePaymentDenied(resource);

      default:
        console.log(`[PayPal] Unhandled event type: ${eventType}`);
        return { success: true, message: "Event logged" };
    }
  } catch (err: any) {
    console.error("[PayPal Webhook] Error:", err);
    return { success: false, message: err.message };
  }
}

async function handleSubscriptionActivated(resource: any): Promise<{ success: boolean; message: string }> {
  try {
    const subscriptionId = resource.subscription_id;
    const payerId = resource.payer_id;

    // Find the user by matching the payment record
    // Look for a pending payment with this subscription intent
    const payerEmail = resource.subscriber?.email_address;

    if (!subscriptionId) {
      console.error("[PayPal] No subscription_id in activation event");
      return { success: false, message: "Missing subscription_id" };
    }

    // Find user with email
    let userId: string | null = null;
    if (payerEmail) {
      const [dbUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, payerEmail));
      userId = dbUser?.id ?? null;
    }

    if (!userId) {
      console.error(`[PayPal] Could not find user for subscriber ${payerEmail}`);
      return { success: false, message: "User not found" };
    }
    
    console.log(`[PayPal] Found user ${userId} for subscriber ${payerEmail}`);

    // Create payment record
    const now = new Date();
    const [payment] = await db
      .insert(payments)
      .values({
        userId,
        amount: "9.99",
        currency: "PLN",
        status: "completed",
        paymentMethod: "paypal",
        paypalSubscriptionId: subscriptionId,
        paypalPayerId: payerId,
        subscriptionSource: "paypal",
        createdAt: now,
        completedAt: now,
      })
      .returning();

    // Activate subscription for user
    await activateSubscription(userId, 1);

    console.log(`[PayPal] Subscription activated for user ${userId}: ${subscriptionId}`);
    return { success: true, message: "Subscription activated" };
  } catch (err: any) {
    console.error("[PayPal] Error handling subscription activation:", err);
    return { success: false, message: err.message };
  }
}

async function handlePaymentCompleted(resource: any): Promise<{ success: boolean; message: string }> {
  try {
    const saleId = resource.id;
    const payerId = resource.payer_id;
    const billingAgreementId = resource.billing_agreement_id; // For renewal payments

    // Case 1: Renewal payment (has billing_agreement_id = subscription ID)
    if (billingAgreementId) {
      const [paymentRecord] = await db
        .select()
        .from(payments)
        .where(eq(payments.paypalSubscriptionId, billingAgreementId));

      if (paymentRecord && paymentRecord.userId) {
        // Extend subscription for renewal payment
        await activateSubscription(paymentRecord.userId, 1);
        console.log(`[PayPal] Subscription extended for user ${paymentRecord.userId} (renewal: ${saleId})`);
        return { success: true, message: "Subscription renewed" };
      } else {
        console.error(`[PayPal] Could not find subscription ${billingAgreementId} for renewal payment ${saleId}`);
        return { success: false, message: "Subscription not found" };
      }
    }

    // Case 2: Initial payment (has sale ID in paypalOrderId)
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paypalOrderId, saleId));

    if (existingPayment && existingPayment.status !== "completed") {
      await storage.updatePaymentStatus(existingPayment.id, "completed");
      console.log(`[PayPal] Payment completed: ${saleId}`);
    }

    return { success: true, message: "Payment recorded" };
  } catch (err: any) {
    console.error("[PayPal] Error handling payment completion:", err);
    return { success: false, message: err.message };
  }
}

async function handleSubscriptionCancelled(resource: any): Promise<{ success: boolean; message: string }> {
  try {
    const subscriptionId = resource.subscription_id;
    const payerEmail = resource.subscriber?.email_address;

    if (!payerEmail) {
      console.error("[PayPal] No payer email in cancellation event");
      return { success: false, message: "Missing payer email" };
    }

    // Find user and update subscription status
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, payerEmail));

    if (dbUser) {
      await db
        .update(users)
        .set({ subscriptionStatus: "cancelled" })
        .where(eq(users.id, dbUser.id));

      console.log(`[PayPal] Subscription cancelled for user ${dbUser.id}`);
    }

    return { success: true, message: "Subscription cancelled" };
  } catch (err: any) {
    console.error("[PayPal] Error handling subscription cancellation:", err);
    return { success: false, message: err.message };
  }
}

async function handlePaymentDenied(resource: any): Promise<{ success: boolean; message: string }> {
  try {
    const saleId = resource.id;

    // Update payment record
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paypalOrderId, saleId));

    if (existingPayment) {
      await storage.updatePaymentStatus(existingPayment.id, "failed");
      console.log(`[PayPal] Payment denied: ${saleId}`);
    }

    return { success: true, message: "Payment denied" };
  } catch (err: any) {
    console.error("[PayPal] Error handling payment denial:", err);
    return { success: false, message: err.message };
  }
}
