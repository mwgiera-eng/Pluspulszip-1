import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function resolveDistPath() {
  const candidates = [
    process.env.CLIENT_DIST_DIR,
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(__dirname, "public"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find the client build. Checked: ${candidates.join(", ")}`,
  );
}

export function serveStatic(app: Express) {
  const distPath = resolveDistPath();
  const indexPath = path.join(distPath, "index.html");

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    severity: "INFO",
    source: "static",
    message: `serving client from ${distPath}`,
  }));

  app.get("/", (_req, res) => {
    res.sendFile(indexPath);
  });

  app.use(express.static(distPath, { index: false }));

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ message: "API route not found" });
    }

    return next();
  });

  app.get("/{*path}", (_req, res) => {
    res.sendFile(indexPath);
  });
}
