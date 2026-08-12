import { build as viteBuild } from "vite";
import { build as esbuild } from "esbuild";

await viteBuild();
await esbuild({
  entryPoints: ["server/index.ts"],
  platform: "node",
  bundle: true,
  format: "cjs",
  outfile: "dist/index.cjs",
  packages: "external",
  define: { "process.env.NODE_ENV": '"production"' },
  sourcemap: true,
});
