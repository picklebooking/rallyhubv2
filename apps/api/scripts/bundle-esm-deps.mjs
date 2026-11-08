// Bundles ESM-only packages into the compiled API so it never require()s an ES
// module at runtime.
//
// The API compiles to CommonJS. Several runtime dependencies ship only as ES
// modules (@thallesp/nestjs-better-auth, better-auth, @better-auth/*,
// @nestjs/mapped-types). Node 22.12+ can require() them, but Vercel's Node 22
// launcher starts functions with --no-experimental-require-module, so they
// fail with ERR_REQUIRE_ESM. This step rewrites dist/main.js as one CommonJS
// bundle that inlines those packages (converted to CommonJS by esbuild) and
// leaves every package that has a CommonJS entry as an ordinary external
// require(). Run it after `nest build`; it only runs in the Vercel build.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire, builtinModules } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(apiRoot, 'dist', 'main.js');

if (readFileSync(entry, 'utf8').includes('__bundleImportMetaUrl')) {
  console.error(
    'dist/main.js is already bundled. Run `nest build` first (it does not clear dist).',
  );
  process.exit(1);
}

/** Package name of a bare import: `@scope/pkg/sub` -> `@scope/pkg`. */
function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Nearest package.json "type" for a resolved file. */
function nearestPackageType(file) {
  let dir = dirname(file);
  for (;;) {
    try {
      return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).type;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }
}

/**
 * How Node's require() would load `specifier` from `importer`:
 * 'cjs' (safe to leave external), 'esm' (must be bundled) or 'missing'.
 */
function requireFormat(specifier, importer) {
  let resolved;
  try {
    resolved = createRequire(importer).resolve(specifier);
  } catch (error) {
    // Exported for `import` only: an ES module.
    if (error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return 'esm';
    return 'missing';
  }
  if (resolved.endsWith('.mjs')) return 'esm';
  if (resolved.endsWith('.cjs')) return 'cjs';
  return nearestPackageType(resolved) === 'module' ? 'esm' : 'cjs';
}

/** Every .js file under dir, recursively. */
function listJsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const path = join(dir, dirent.name);
    if (dirent.isDirectory()) return listJsFiles(path);
    return dirent.name.endsWith('.js') ? [path] : [];
  });
}

/**
 * CommonJS packages our own compiled code requires. They must stay single,
 * shared externals: an inlined package that imports one of them (for example
 * @thallesp/nestjs-better-auth importing @nestjs/core) has to get the same
 * copy, or Nest ends up with two separate dependency-injection containers.
 * All of @nestjs/* stays external because Nest loads its platform packages
 * itself at runtime.
 */
const sharedPackages = new Set(
  listJsFiles(join(apiRoot, 'dist'))
    .flatMap((file) => [
      ...readFileSync(file, 'utf8').matchAll(/require\("([^"./][^"]*)"\)/g),
    ])
    .map((match) => packageName(match[1]))
    .filter((name) => !name.startsWith('node:')),
);
const isShared = (name) =>
  sharedPackages.has(name) || name.startsWith('@nestjs/');

const bundled = new Set();

const esmOnlyPlugin = {
  name: 'bundle-esm-only-packages',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
      const name = packageName(args.path);
      if (args.path.startsWith('node:') || builtinModules.includes(name)) {
        return { path: args.path, external: true };
      }
      const format = requireFormat(args.path, args.importer || entry);
      // Inside an inlined package, inline its dependencies too: a CommonJS
      // dependency can still require() an ES module of its own (better-call
      // requires rou3). Our own code's CommonJS imports stay external.
      const fromInlinedPackage = args.importer.includes('/node_modules/');
      if (format === 'cjs' && isShared(name)) {
        return { path: args.path, external: true };
      }
      if (format === 'esm' || (fromInlinedPackage && format === 'cjs')) {
        bundled.add(name);
        return undefined; // let esbuild resolve and inline it
      }
      // CommonJS packages stay external. So do optional packages that are not
      // installed: requiring them fails only if that code path runs, as before.
      return { path: args.path, external: true };
    });
  },
};

const result = await build({
  entryPoints: [entry],
  outfile: entry,
  allowOverwrite: true,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // ESM code that reads import.meta.url gets this bundle's own URL.
  define: { 'import.meta.url': '__bundleImportMetaUrl' },
  banner: {
    js: "const __bundleImportMetaUrl = require('node:url').pathToFileURL(__filename).href;",
  },
  // Keep class and function names: Nest and logs read them.
  keepNames: true,
  logLevel: 'warning',
  plugins: [esmOnlyPlugin],
  metafile: true,
});

const kib = Math.round(Object.values(result.metafile.outputs)[0].bytes / 1024);
console.log(
  `Bundled ESM-only packages into dist/main.js (${kib} KiB): ${[...bundled].sort().join(', ') || 'none'}`,
);

// Fail the build if anything in the bundle still require()s an ES module.
const output = readFileSync(entry, 'utf8');
const leftovers = [...output.matchAll(/require\("([^"./][^"]*)"\)/g)]
  .map((match) => match[1])
  .filter((specifier) => !specifier.startsWith('node:'))
  .filter((specifier) => requireFormat(specifier, entry) === 'esm');
if (leftovers.length > 0) {
  console.error(
    `dist/main.js still requires ES modules: ${[...new Set(leftovers)].join(', ')}`,
  );
  process.exit(1);
}
writeFileSync(entry, output);
