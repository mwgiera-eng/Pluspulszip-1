import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { build as esbuild, type Plugin } from "esbuild";
import { build as viteBuild } from "vite";

const root = process.cwd();

function resolveSource(relativePath: string): string {
  const base = path.resolve(root, relativePath);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return base;
}

const aliasPlugin: Plugin = {
  name: "pluspuls-path-aliases",
  setup(build) {
    const aliases: Array<[RegExp, string]> = [
      [/^@shared\/(.*)$/, "shared"],
      [/^@assets\/(.*)$/, "attached_assets"],
      [/^@\/(.*)$/, "client/src"],
    ];

    for (const [pattern, target] of aliases) {
      build.onResolve({ filter: pattern }, (args) => {
        const match = args.path.match(pattern);
        return {
          path: resolveSource(path.join(target, match?.[1] ?? "")),
        };
      });
    }
  },
};

await rm(path.resolve(root, "dist"), { recursive: true, force: true });

await viteBuild();

await esbuild({
  entryPoints: [path.resolve(root, "server/index.ts")],
  outfile: path.resolve(root, "dist/index.cjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  packages: "external",
  define: {
    "process.env.NODE_ENV": "\"production\"",
  },
  plugins: [aliasPlugin],
});

console.log("Built Render production bundle in dist/");
