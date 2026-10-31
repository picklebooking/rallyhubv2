import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentTenant } from './current-tenant.decorator';

/**
 * Extracts the factory function from the decorator metadata.
 */
function getParamDecoratorFactory() {
  class TestController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@CurrentTenant() _tenantId: string) {
      // Test target
    }
  }

  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'handler',
  ) as Record<
    string,
    {
      factory: (data: unknown, ctx: ExecutionContext) => string;
    }
  >;

  const key = Object.keys(metadata)[0];

  return metadata[key].factory;
}

/**
 * Creates a mock ExecutionContext with resolved request context.
 */
function createMockExecutionContext(
  tenantId?: unknown,
  headers: Record<string, unknown> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        tenantId,
        headers,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('@CurrentTenant() decorator', () => {
  let factory: (data: unknown, ctx: ExecutionContext) => string;

  beforeAll(() => {
    factory = getParamDecoratorFactory();
  });

  it('should return the tenant ID resolved by middleware', () => {
    const ctx = createMockExecutionContext('tenant-123');

    const result = factory(undefined, ctx);

    expect(result).toBe('tenant-123');
  });

  it('should throw BadRequestException when tenantId is missing', () => {
    const ctx = createMockExecutionContext();

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when tenantId is not a string', () => {
    const ctx = createMockExecutionContext(12345);

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when tenantId is an empty string', () => {
    const ctx = createMockExecutionContext('');

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when request context is missing', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('should include a helpful error message', () => {
    const ctx = createMockExecutionContext();

    expect(() => factory(undefined, ctx)).toThrow('Tenant context required');
  });

  it('should return the correct tenantId for different tenants', () => {
    const tenantIds = ['tenant-001', 'tenant-002', 'tenant-003'];

    tenantIds.forEach((tenantId) => {
      const ctx = createMockExecutionContext(tenantId);

      expect(factory(undefined, ctx)).toBe(tenantId);
    });
  });

  it('ignores a caller supplied tenantid header', () => {
    const ctx = createMockExecutionContext('resolved-tenant', {
      tenantid: 'other-tenant',
    });
    expect(factory(undefined, ctx)).toBe('resolved-tenant');
  });
});
