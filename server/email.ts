import { config } from "./config";

export async function deliverAccountEmail(message: { to: string; kind: "verify" | "reset"; token: string }) {
  if (!config.EMAIL_DELIVERY_URL || !config.EMAIL_API_KEY) return false;
  const path = message.kind === "verify" ? "/verify-email" : "/reset-password";
  const response = await fetch(config.EMAIL_DELIVERY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.EMAIL_API_KEY}` },
    body: JSON.stringify({ to: message.to, template: message.kind, actionUrl: `${config.APP_URL}${path}?token=${encodeURIComponent(message.token)}` }),
  });
  if (!response.ok) throw new Error("Email provider rejected account email");
  return true;
}
