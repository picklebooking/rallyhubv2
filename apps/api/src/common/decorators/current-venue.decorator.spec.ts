import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentVenue } from './current-venue.decorator';

// Helper to extract the factory function from the decorator metadata.
// NestJS param decorators store their factory under ROUTE_ARGS_METADATA.
function getParamDecoratorFactory() {
  class TestController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@CurrentVenue() _venueId: string) {
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

describe('@CurrentVenue() decorator', () => {
  let factory: (data: unknown, ctx: ExecutionContext) => string;

  beforeAll(() => {
    factory = getParamDecoratorFactory();
  });

  it('returns the venueId from the request', () => {
    const ctx = createMockExecutionContext({ venueId: 'venue-123' });

    const result = factory(undefined, ctx);

    expect(result).toBe('venue-123');
  });

  it('throws BadRequestException when venueId is missing', () => {
    const ctx = createMockExecutionContext({});

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when venueId is not a string', () => {
    const ctx = createMockExecutionContext({ venueId: 12345 });

    expect(() => factory(undefined, ctx)).toThrow(BadRequestException);
  });

  it('throws BadRequestException when venueId is an empty string', () => {
    const ctx = createMockExecutionContext({ venueId: '' });

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
        'Venue context required',
      );
    }
  });
});
