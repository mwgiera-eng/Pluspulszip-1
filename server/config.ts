import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must contain at least 32 characters"),
  APP_URL: z.string().url().optional(),
  EMAIL_DELIVERY_URL: z.string().url().optional(),
  EMAIL_API_KEY: z.string().min(1).optional(),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.APP_URL) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["APP_URL"], message: "APP_URL is required in production" });
  }
  if (!!value.EMAIL_DELIVERY_URL !== !!value.EMAIL_API_KEY) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["EMAIL_DELIVERY_URL"], message: "EMAIL_DELIVERY_URL and EMAIL_API_KEY must be set together" });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid server configuration: ${details}`);
}

export const config = parsed.data;
