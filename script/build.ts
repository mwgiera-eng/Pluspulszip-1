import { build as buildServer } from "esbuild";
import { build as buildClient } from "vite";

async function build() {
  await buildClient();

  await buildServer({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    packages: "external",
    sourcemap: true,
  });

  await buildServer({
    entryPoints: ["server/migrate.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/migrate.cjs",
    packages: "external",
    sourcemap: true,
  });
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
