// Replit OIDC integration removed. Importing this file now will throw to prevent accidental use.

export function setupAuth(): never {
  throw new Error("Replit OIDC integration has been removed. Use GCP identity or ./server/auth for the replacement shim.");
}

export function getSession(): never {
  throw new Error("Replit OIDC integration has been removed.");
}

export function registerAuthRoutes(): never {
  throw new Error("Replit OIDC integration has been removed.");
}

export const isAuthenticated = () => {
  throw new Error("Replit OIDC integration has been removed.");
};

export const authNotAvailableMessage = "Replit OIDC integration removed. Use GCP identity or server/auth.";
