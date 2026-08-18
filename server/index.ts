import crypto from "node:crypto";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerTrustRoutes } from "./trustRoutes";
import { registerFleetRoutes } from "./fleetRoutes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" { interface IncomingMessage { rawBody: unknown; } }
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb", verify: (request, _response, buffer) => { request.rawBody = buffer; } }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use((_request, response, next) => { const requestId = crypto.randomUUID(); response.locals.requestId = requestId; response.setHeader("X-Request-Id", requestId); next(); });
app.get("/health", (_request, response) => { response.json({ status: "ok" }); });

export function log(message: string, source = "express") { console.log(JSON.stringify({ timestamp: new Date().toISOString(), severity: "INFO", source, message })); }
app.use((request, response, next) => { const start = Date.now(); response.on("finish", () => { if (request.path.startsWith("/api")) console.log(JSON.stringify({ timestamp: new Date().toISOString(), severity: "INFO", source: "http", requestId: response.locals.requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - start })); }); next(); });

(async () => {
  registerTrustRoutes(app);
  await registerRoutes(httpServer, app);
  registerFleetRoutes(app);
  app.use((error: any, _request: Request, response: Response, next: NextFunction) => {
    const status = Number.isInteger(error?.status) ? error.status : error?.name === "ZodError" ? 400 : 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), severity: "ERROR", source: "express", requestId: response.locals.requestId, status: safeStatus, error: process.env.NODE_ENV === "production" ? "Request failed" : String(error?.message || "Internal Server Error") }));
    if (response.headersSent) return next(error);
    return response.status(safeStatus).json({ message: safeStatus >= 500 ? "Internal Server Error" : "Invalid request", requestId: response.locals.requestId });
  });
  if (process.env.NODE_ENV === "production") serveStatic(app); else { const { setupVite } = await import("./vite"); await setupVite(httpServer, app); }
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => log(`serving on port ${port}`));
  const shutdown = () => { log("Shutting down gracefully..."); httpServer.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000); };
  process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
})();
