import { delimiter, join } from 'node:path';
import { addNodePath, getVercelNestedModulesPath } from './module-paths';

describe('getVercelNestedModulesPath', () => {
  it('returns apps/api/node_modules beside the build output when it exists', () => {
    const exists = (path: string): boolean =>
      path === join('/var/task', 'apps', 'api', 'node_modules');

    expect(getVercelNestedModulesPath('/var/task', exists)).toBe(
      '/var/task/apps/api/node_modules',
    );
  });

  it('returns undefined outside the Vercel layout', () => {
    expect(
      getVercelNestedModulesPath('/repo/apps/api/dist', () => false),
    ).toBeUndefined();
  });
});

describe('addNodePath', () => {
  it('sets NODE_PATH when it is empty', () => {
    expect(addNodePath(undefined, '/var/task/apps/api/node_modules')).toBe(
      '/var/task/apps/api/node_modules',
    );
  });

  it('appends to an existing NODE_PATH', () => {
    expect(addNodePath('/opt/lib', '/x/node_modules')).toBe(
      ['/opt/lib', '/x/node_modules'].join(delimiter),
    );
  });

  it('does not add the same path twice', () => {
    expect(addNodePath('/x/node_modules', '/x/node_modules')).toBe(
      '/x/node_modules',
    );
  });
});
