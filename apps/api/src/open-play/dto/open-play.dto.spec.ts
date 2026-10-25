import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EnableOpenPlayDto,
  ListOpenPlayQueryDto,
  SetOpenPlayVisibilityDto,
} from '.';

async function props<T extends object>(
  cls: new () => T,
  plain: object,
): Promise<string[]> {
  return (await validate(plainToInstance(cls, plain))).map((e) => e.property);
}

describe('ListOpenPlayQueryDto', () => {
  it('accepts an empty query', async () => {
    expect(await props(ListOpenPlayQueryDto, {})).toEqual([]);
  });

  it('coerces numeric strings', async () => {
    const dto = plainToInstance(ListOpenPlayQueryDto, {
      page: '2',
      pageSize: '50',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.page).toBe(2);
  });

  it.each([
    [{ page: 'abc' }, 'page'],
    [{ page: '0' }, 'page'],
    [{ pageSize: '0' }, 'pageSize'],
    [{ pageSize: '51' }, 'pageSize'],
    [{ venueId: '' }, 'venueId'],
    [{ venueId: 'not-a-uuid' }, 'venueId'],
    [{ from: 'yesterday' }, 'from'],
    [{ to: '2026-13-01' }, 'to'],
  ])('rejects %p', async (plain, property) => {
    expect(await props(ListOpenPlayQueryDto, plain)).toContain(property);
  });
});

describe('EnableOpenPlayDto', () => {
  it.each([0, -2, 1.5, '4', 65, 2147483648])(
    'rejects capacity %p',
    async (capacity) => {
      expect(await props(EnableOpenPlayDto, { capacity })).toContain(
        'capacity',
      );
    },
  );
  it('accepts an empty body and capacity 1 to 64', async () => {
    expect(await props(EnableOpenPlayDto, {})).toEqual([]);
    expect(
      await props(EnableOpenPlayDto, { capacity: 1, isPublic: true }),
    ).toEqual([]);
    expect(await props(EnableOpenPlayDto, { capacity: 64 })).toEqual([]);
  });
});

describe('SetOpenPlayVisibilityDto', () => {
  it('requires a boolean isPublic', async () => {
    expect(await props(SetOpenPlayVisibilityDto, {})).toContain('isPublic');
    expect(
      await props(SetOpenPlayVisibilityDto, { isPublic: 'true' }),
    ).toContain('isPublic');
    expect(await props(SetOpenPlayVisibilityDto, { isPublic: false })).toEqual(
      [],
    );
  });
});
