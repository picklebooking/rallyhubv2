import { bookableCourtWhere } from './court-bookability';

describe('bookableCourtWhere', () => {
  it('requires an ACTIVE court, venue and tenant', () => {
    expect(bookableCourtWhere()).toEqual({
      status: 'ACTIVE',
      venue: { status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
    });
  });
});
