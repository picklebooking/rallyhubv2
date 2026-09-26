import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentTenant } from './current-tenant.decorator';

// Helper to extract the factory function from the decorator metadata.
// NestJS param decorators store their factory under ROUTE_ARGS_METADATA.
function getParamDecoratorFactory() {
  class TestController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@CurrentTenant() _tenantId: string) {
      /* test target */
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'handler',
  );

  // The metadata is keyed like `<decoratorKey>:0` where 0 is the param index.
  const key = Object.keys(metadata as Record<string, unknown>)[0];
  return (
    metadata as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => string }
    >
  )[key].factory;
}

function createMockExecutionContext(
  requestOverrides: Record<string, unknown> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => requestOverrides,
    }),
  } as unknown as ExecutionContext;
}

describe('@CurrentTenant() decorator', () => {
  let factory: (data: unknown, ctx: ExecutionContext) => string;

  beforeAll(() => {
    factory = getParamDecoratorFactory();
  });

  it('returns the tenantId from the request', () => {
    const ctx = createMockExecutionContext({ tenantId: 'tenant-123' });

    const result = factory(undefined, ctx);

    expect(result).toBe('tenant-123');
  });

  it('throws BadRequestException when tenantId is missing', () => {
    const ctx = createMockExecutionContext({});

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when tenantId is not a string', () => {
    const ctx = createMockExecutionContext({ tenantId: 12345 });

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when tenantId is an empty string', () => {
    const ctx = createMockExecutionContext({ tenantId: '' });

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('includes a helpful error message', () => {
    const ctx = createMockExecutionContext({});

    try {
      factory(undefined, ctx);
      fail('Expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toContain(
        'Tenant context required',
      );
    }
  });
});
