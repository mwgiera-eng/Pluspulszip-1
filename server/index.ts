import crypto from "node:crypto";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerTrustRoutes } from "./trustRoutes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export function log(message: string, source = "express") {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    severity: "INFO",
    source,
    message,
  }));
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        severity: "INFO",
        source: "http",
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      }));
    }
  });
  next();
});

(async () => {
  registerTrustRoutes(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      severity: "ERROR",
      source: "express",
      requestId: res.locals.requestId,
      status: safeStatus,
      error: process.env.NODE_ENV === "production" ? "Request failed" : String(err?.message || "Internal Server Error"),
    }));
    if (res.headersSent) return next(err);
    return res.status(safeStatus).json({
      message: safeStatus >= 500 ? "Internal Server Error" : String(err?.message || "Request failed"),
      requestId: res.locals.requestId,
    });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => log(`serving on port ${port}`));

  const shutdown = () => {
    log("Shutting down gracefully...");
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
