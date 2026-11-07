import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCourtBookingDto } from './create-court-booking.dto';

const base = {
  date: '2026-11-01T10:00:00.000Z',
  courtId: 'court-1',
  rentDuration: 2,
  isOpenPlay: true,
};

async function errorsFor(extra: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreateCourtBookingDto, { ...base, ...extra });
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('CreateCourtBookingDto open play fields', () => {
  it.each([0, -1, 2.5, '4', 65, 2147483648])(
    'rejects openPlayCapacity %p',
    async (value) => {
      expect(await errorsFor({ openPlayCapacity: value })).toContain(
        'openPlayCapacity',
      );
    },
  );

  it('accepts openPlayCapacity 1 and 64, and omitting it', async () => {
    expect(await errorsFor({ openPlayCapacity: 1 })).toEqual([]);
    expect(await errorsFor({ openPlayCapacity: 64 })).toEqual([]);
    expect(await errorsFor({})).toEqual([]);
  });

  it('rejects a non-boolean isOpenPlayPublic', async () => {
    expect(await errorsFor({ isOpenPlayPublic: 'yes' })).toContain(
      'isOpenPlayPublic',
    );
  });
});

it('has no email property or validation requirement', async () => {
  expect('email' in new CreateCourtBookingDto()).toBe(false);
  expect(await errorsFor({})).toEqual([]);
});
