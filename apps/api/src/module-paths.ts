import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * Lets the compiled API find packages npm installed under
 * `apps/api/node_modules` when it runs on Vercel.
 *
 * Vercel ships the `nest build` output (`dist/`) at the function root
 * (`/var/task/main.js`) but copies traced dependencies to their repo-relative
 * paths. Root `node_modules` lands at `/var/task/node_modules`, which Node
 * finds; `apps/api/node_modules` lands at `/var/task/apps/api/node_modules`,
 * which Node never searches from `/var/task`, so packages that only live there
 * (`@thallesp/nestjs-better-auth`, `better-auth`, `@prisma/client`, ...) fail
 * with "Cannot find module".
 *
 * That folder only exists beside the build output in Vercel's layout, so this
 * is a no-op locally, in Docker and in tests. `register-module-paths.ts` applies
 * it and must be imported before any other module in `main.ts`.
 */
export function getVercelNestedModulesPath(
  outputDir: string,
  exists: (path: string) => boolean = existsSync,
): string | undefined {
  const nested = join(outputDir, 'apps', 'api', 'node_modules');
  return exists(nested) ? nested : undefined;
}

/** Appends a directory to a NODE_PATH value without duplicating it. */
export function addNodePath(current: string | undefined, path: string): string {
  const paths = (current ?? '').split(delimiter).filter(Boolean);
  if (!paths.includes(path)) paths.push(path);
  return paths.join(delimiter);
}
