#!/usr/bin/env node
/**
 * Bundles scripts/worker.ts (the src/lib code it imports and its npm
 * dependencies) into a single ESM file, .worker/worker.mjs, that runs with
 * plain `node` — no Next.js, no tsx at runtime.
 *
 * Only Prisma's client stays external: it loads its generated client and
 * query-compiler files at runtime, and the Next.js standalone output already
 * ships them (/app/node_modules/@prisma/client in the image). Turbopack
 * bundles most other packages into server chunks, so they are NOT in the
 * standalone node_modules and must be bundled here.
 *
 * When .next/standalone exists (i.e. after `next build`), the externals are
 * checked to resolve from a copy of the image layout (an isolated directory
 * with only the standalone node_modules), so a missing package fails the
 * build instead of the worker container.
 */
import { build } from "esbuild";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { builtinModules } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const outfile = path.join(root, ".worker", "worker.mjs");

const result = await build({
  entryPoints: [path.join(root, "scripts", "worker.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["@prisma/client", ".prisma/*", "pg-native"],
  // Bundled CommonJS packages (pg, ...) call require() for node builtins.
  banner: { js: 'import { createRequire as __kcCreateRequire } from "node:module"; const require = __kcCreateRequire(import.meta.url);' },
  sourcemap: "linked",
  metafile: true,
  logLevel: "warning",
  tsconfig: path.join(root, "tsconfig.json"),
});

const externals = new Set();
for (const output of Object.values(result.metafile.outputs)) {
  for (const imp of output.imports) {
    if (imp.external && !imp.path.startsWith("node:")) {
      externals.add(imp.path);
    }
  }
}
console.log(`[build-worker] ${path.relative(root, outfile)} (${externals.size} external packages)`);

const standalone = path.join(root, ".next", "standalone");
if (existsSync(standalone)) {
  const specifiers = [...externals].filter((s) => !builtinModules.includes(s.split("/")[0]) && s !== "pg-native");
  // Image layout: /app/worker.mjs next to /app/node_modules, nothing above.
  const sandbox = mkdtempSync(path.join(tmpdir(), "kc-worker-probe-"));
  try {
    symlinkSync(path.join(standalone, "node_modules"), path.join(sandbox, "node_modules"), "dir");
    const probe = path.join(sandbox, "worker-probe.mjs");
    writeFileSync(
      probe,
      `const missing = [];\nfor (const s of ${JSON.stringify(specifiers)}) {\n  try { import.meta.resolve(s); } catch { missing.push(s); }\n}\nif (missing.length) { console.error("[build-worker] not resolvable from the standalone node_modules:", missing.join(", ")); process.exit(1); }\n`
    );
    const check = spawnSync(process.execPath, [probe], { stdio: "inherit", cwd: sandbox });
    if (check.status !== 0) {
      console.error("[build-worker] bundle the package (remove it from `external`) or trace it via outputFileTracingIncludes");
      process.exit(1);
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  console.log(`[build-worker] external packages resolve from the standalone node_modules: ${specifiers.join(", ")}`);
}
