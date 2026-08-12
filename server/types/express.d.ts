import type { AuthenticatedUser } from "../replit_integrations/auth/replitAuth";

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export {};
