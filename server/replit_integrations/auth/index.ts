// Deprecated replit integration shim. Re-exports server/auth to preserve import compatibility while
// removing Replit-specific implementation. Do not rely on this file for new code — import from ../auth instead.
export { setupAuth, isAuthenticated, registerAuthRoutes, authStorage } from "../../auth";
