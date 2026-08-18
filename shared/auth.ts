import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Podaj prawidłowy adres e-mail").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Hasło musi mieć co najmniej 10 znaków")
  .max(128, "Hasło jest zbyt długie")
  .regex(/[a-z]/, "Hasło musi zawierać małą literę")
  .regex(/[A-Z]/, "Hasło musi zawierać wielką literę")
  .regex(/[0-9]/, "Hasło musi zawierać cyfrę");

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Podaj imię").max(80),
    lastName: z.string().trim().min(1, "Podaj nazwisko").max(80),
    email: emailSchema,
    password: passwordSchema,
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: "Zaakceptuj warunki korzystania" }),
    }),
    privacyAccepted: z.literal(true, {
      errorMap: () => ({ message: "Potwierdź zapoznanie się z informacją o prywatności" }),
    }),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
