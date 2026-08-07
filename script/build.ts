import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { build } from "esbuild";

// Clean previous build
rmSync("dist", { recursive: true, force: true });

// 1) Build the client with Vite -> dist/public
console.log("Building client (vite)...");
execSync("npx vite build", { stdio: "inherit" });

// 2) Bundle the server with esbuild -> dist/index.cjs
console.log("Building server (esbuild)...");
await build({
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/index.cjs",
  packages: "external",
  plugins: [
    {
      // server/vite.ts is dev-only (dynamically imported when NODE_ENV=development).
      // It drags in vite.config.ts (top-level await), which can't be bundled as CJS.
      // Production never calls it, so replace it with a stub.
      name: "stub-dev-vite",
      setup(b) {
        b.onResolve({ filter: /^\.\/vite$/ }, (args) => ({
          path: args.path,
          namespace: "stub-dev-vite",
        }));
        b.onLoad({ filter: /.*/, namespace: "stub-dev-vite" }, () => ({
          contents: `export function setupVite() { throw new Error("setupVite is dev-only and not available in the production build"); }`,
          loader: "js",
        }));
      },
    },
  ],
});

console.log("Build complete: dist/index.cjs + dist/public");
