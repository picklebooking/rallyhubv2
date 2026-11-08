import Module from 'node:module';
import { addNodePath, getVercelNestedModulesPath } from './module-paths';

// See module-paths.ts. Import this first in main.ts, before anything that
// requires a package from apps/api/node_modules.
type ModuleWithInitPaths = typeof Module & { _initPaths?: () => void };

const nestedModulesPath = getVercelNestedModulesPath(__dirname);

if (nestedModulesPath) {
  process.env.NODE_PATH = addNodePath(process.env.NODE_PATH, nestedModulesPath);
  // Node reads NODE_PATH once at startup; re-read it for this process.
  (Module as ModuleWithInitPaths)._initPaths?.();
}
