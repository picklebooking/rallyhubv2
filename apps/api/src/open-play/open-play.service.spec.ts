import { jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ErrorConstant } from '../constants/error-code.constant';
import { OpenPlayTokenHelper } from '../helper/open-play-token.helper';
import type {
  OpenPlayBookingRecord,
  OpenPlayRepository,
} from './open-play.repository';
import { OpenPlayService } from './open-play.service';

const DAY = 24 * 60 * 60 * 1000;
const FORBIDDEN = [
  'userEmail',
  'userId',
  'referenceId',
  'isPaid',
  'totalPrice',
  'openPlayJoinToken',
  'joinToken',
  'tenantId',
];

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.push(k);
      collectKeys(v, keys);
    }
  }
  return keys;
}

function booking(
  overrides: Partial<OpenPlayBookingRecord> = {},
): OpenPlayBookingRecord {
  return {
    id: 'b-1',
    bookDate: new Date(Date.now() + 7 * DAY),
    openPlayCapacity: 4,
    venueId: 'v-1',
    userId: 'booker',
    isActive: true,
    isOpenPlay: true,
    isOpenPlayPublic: true,
    openPlayJoinToken: 'tok',
    court: {
      id: 'c-1',
      name: 'Court 1',
      venue: {
        id: 'v-1',
        tenantId: 't-1',
        name: 'Downtown',
        slug: 'downtown',
        city: 'Cebu',
        timezone: 'Asia/Manila',
        status: 'ACTIVE',
      },
    },
    confirmedSeats: 1,
    ...overrides,
  };
}

describe('OpenPlayService', () => {
  let repo: jest.Mocked<OpenPlayRepository>;
  let tokenHelper: jest.Mocked<OpenPlayTokenHelper>;
  let service: OpenPlayService;

  beforeEach(() => {
    repo = {
      listPublic: jest.fn(),
      findById: jest.fn(),
      findViewableById: jest.fn(),
      findViewableByToken: jest.fn(),
      findSeat: jest.fn(),
      findRoster: jest.fn(),
      hasVenueStaffMembership: jest.fn(),
      joinSeat: jest.fn(),
      leaveSeat: jest.fn(),
      cancelBooking: jest.fn(),
      enableOpenPlay: jest.fn(),
      setVisibility: jest.fn(),
    } as unknown as jest.Mocked<OpenPlayRepository>;
    repo.hasVenueStaffMembership.mockResolvedValue(false);
    repo.findRoster.mockResolvedValue([]);
    tokenHelper = {
      generate: jest.fn(),
    } as unknown as jest.Mocked<OpenPlayTokenHelper>;
    tokenHelper.generate.mockReturnValue('new-token');
    service = new OpenPlayService(repo, tokenHelper);
  });

  describe('list', () => {
    it('maps records without forbidden keys and marks full ones', async () => {
      repo.listPublic.mockResolvedValue({
        records: [booking({ confirmedSeats: 4 })],
        total: 1,
      });

      const result = await service.list({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items[0]).toEqual({
        id: 'b-1',
        startsAt: expect.any(String) as unknown,
        venue: {
          id: 'v-1',
          name: 'Downtown',
          slug: 'downtown',
          city: 'Cebu',
          timezone: 'Asia/Manila',
        },
        court: { id: 'c-1', name: 'Court 1' },
        capacity: 4,
        confirmedSeats: 4,
        isFull: true,
      });
      const keys = collectKeys(result);
      for (const forbidden of FORBIDDEN) expect(keys).not.toContain(forbidden);
    });

    it('translates page/pageSize to skip/take and passes date bounds as Dates', async () => {
      repo.listPublic.mockResolvedValue({ records: [], total: 0 });
      await service.list({
        page: 3,
        pageSize: 10,
        venueId: 'v-1',
        from: '2026-10-10T00:00:00.000Z',
      });
      expect(repo.listPublic).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
          venueId: 'v-1',
          from: new Date('2026-10-10T00:00:00.000Z'),
          to: undefined,
        }),
      );
    });

    // Review Focus #2
    it('returns an empty page with the true total past the last page', async () => {
      repo.listPublic.mockResolvedValue({ records: [], total: 3 });
      const result = await service.list({ page: 99 });
      expect(result).toEqual({ items: [], page: 99, pageSize: 20, total: 3 });
    });
  });

  describe('getByToken', () => {
    // Review Focus #4. findViewableByToken returns null for an unknown token
    // AND for a cancelled / non-ACTIVE-venue / booker-deleted booking (the
    // exclusion itself is pinned by the repository spec and Task 8).
    it('404s when the booking is not viewable', async () => {
      repo.findViewableByToken.mockResolvedValue(null);
      await expect(service.getByToken('x', null)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findViewableByToken).toHaveBeenCalledWith('x');
    });

    it('returns viewer null when signed out, and no forbidden keys', async () => {
      repo.findViewableByToken.mockResolvedValue(
        booking({ isOpenPlayPublic: false }),
      );
      const result = await service.getByToken('tok', null);
      expect(result.viewer).toBeNull();
      expect(result.isPublic).toBe(false);
      const keys = collectKeys(result);
      for (const forbidden of FORBIDDEN) expect(keys).not.toContain(forbidden);
    });

    it('returns viewer seat state when signed in', async () => {
      repo.findViewableByToken.mockResolvedValue(booking());
      repo.findSeat.mockResolvedValue({ isBooker: true });
      const result = await service.getByToken('tok', 'booker');
      expect(result.viewer).toEqual({ hasSeat: true, isBooker: true });
    });
  });

  describe('joinByToken', () => {
    it('404s when the booking is not viewable (cancelled, venue not ACTIVE, booker deleted)', async () => {
      repo.findViewableByToken.mockResolvedValue(null);
      await expect(service.joinByToken('tok', 'u-2')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.joinSeat).not.toHaveBeenCalled();
    });

    it('joins a non-public booking via its token', async () => {
      repo.findViewableByToken.mockResolvedValue(
        booking({ isOpenPlayPublic: false }),
      );
      repo.joinSeat.mockResolvedValue({
        kind: 'JOINED',
        confirmedSeats: 2,
        capacity: 4,
      });
      const result = await service.joinByToken('tok', 'u-2');
      expect(repo.joinSeat).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'b-1',
          userId: 'u-2',
          requirePublic: false,
        }),
      );
      expect(result).toEqual({
        bookingId: 'b-1',
        confirmedSeats: 2,
        capacity: 4,
        isFull: false,
      });
    });

    // Review Focus #3
    it('409s when the booker joins their own booking', async () => {
      repo.findViewableByToken.mockResolvedValue(booking());
      repo.joinSeat.mockResolvedValue({ kind: 'ALREADY_SEATED' });
      await expect(service.joinByToken('tok', 'booker')).rejects.toThrow(
        ConflictException,
      );
    });

    it.each([
      [{ kind: 'FULL' } as const, 'FULL'],
      [{ kind: 'NOT_JOINABLE' } as const, 'NO_LONGER_AVAILABLE'],
      [{ kind: 'BUSY' } as const, 'BUSY'],
    ])('409s on %p with the %s message', async (outcome, messageKey) => {
      repo.findViewableByToken.mockResolvedValue(booking());
      repo.joinSeat.mockResolvedValue(outcome);
      await expect(service.joinByToken('tok', 'u-2')).rejects.toThrow(
        new ConflictException(
          ErrorConstant.OPEN_PLAY_MESSAGES[
            messageKey as keyof typeof ErrorConstant.OPEN_PLAY_MESSAGES
          ],
        ),
      );
    });

    it('409s when the start time has passed, without locking', async () => {
      repo.findViewableByToken.mockResolvedValue(
        booking({ bookDate: new Date(Date.now() - 1000) }),
      );
      await expect(service.joinByToken('tok', 'u-2')).rejects.toThrow(
        ConflictException,
      );
      expect(repo.joinSeat).not.toHaveBeenCalled();
    });
  });

  describe('joinPublic', () => {
    it('404s for a non-public booking so its existence does not leak', async () => {
      repo.findViewableById.mockResolvedValue(
        booking({ isOpenPlayPublic: false }),
      );
      await expect(service.joinPublic('b-1', 'u-2')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.joinSeat).not.toHaveBeenCalled();
    });

    it('404s with the same error when the booking is not viewable at all', async () => {
      repo.findViewableById.mockResolvedValue(null);
      await expect(service.joinPublic('b-1', 'u-2')).rejects.toThrow(
        new NotFoundException(ErrorConstant.OPEN_PLAY_MESSAGES.NOT_FOUND),
      );
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('requires public under the lock', async () => {
      repo.findViewableById.mockResolvedValue(booking());
      repo.joinSeat.mockResolvedValue({
        kind: 'JOINED',
        confirmedSeats: 4,
        capacity: 4,
      });
      const result = await service.joinPublic('b-1', 'u-2');
      expect(repo.joinSeat).toHaveBeenCalledWith(
        expect.objectContaining({ requirePublic: true }),
      );
      expect(result.isFull).toBe(true);
    });
  });

  describe('leave', () => {
    // Review Focus #5
    it('404s when the user holds no seat', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findSeat.mockResolvedValue(null);
      await expect(service.leave('b-1', 'u-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('409s for the booker', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findSeat.mockResolvedValue({ isBooker: true });
      await expect(service.leave('b-1', 'booker')).rejects.toThrow(
        ConflictException,
      );
    });

    it('409s inside the 24h cutoff', async () => {
      repo.findById.mockResolvedValue(
        booking({ bookDate: new Date(Date.now() + DAY - 60_000) }),
      );
      repo.findSeat.mockResolvedValue({ isBooker: false });
      await expect(service.leave('b-1', 'u-2')).rejects.toThrow(
        ConflictException,
      );
      expect(repo.leaveSeat).not.toHaveBeenCalled();
    });

    it('leaves outside the cutoff', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findSeat.mockResolvedValue({ isBooker: false });
      repo.leaveSeat.mockResolvedValue({ kind: 'LEFT' });
      await expect(service.leave('b-1', 'u-2')).resolves.toBeUndefined();
    });

    it('409s with the retry message when the transaction was busy', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findSeat.mockResolvedValue({ isBooker: false });
      repo.leaveSeat.mockResolvedValue({ kind: 'BUSY' });
      await expect(service.leave('b-1', 'u-2')).rejects.toThrow(
        new ConflictException(ErrorConstant.OPEN_PLAY_MESSAGES.BUSY),
      );
    });
  });

  describe('cancel', () => {
    it('403s for a non-booker', async () => {
      repo.findById.mockResolvedValue(booking());
      await expect(service.cancel('b-1', 'u-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('409s when other players hold seats inside the cutoff', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.cancelBooking.mockResolvedValue({ kind: 'OTHER_PLAYERS' });
      await expect(service.cancel('b-1', 'booker')).rejects.toThrow(
        ConflictException,
      );
    });

    it('409s once the game has started', async () => {
      repo.findById.mockResolvedValue(
        booking({ bookDate: new Date(Date.now() - 1000) }),
      );
      await expect(service.cancel('b-1', 'booker')).rejects.toThrow(
        ConflictException,
      );
    });

    it('cancels', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.cancelBooking.mockResolvedValue({ kind: 'CANCELLED' });
      await expect(service.cancel('b-1', 'booker')).resolves.toBeUndefined();
      expect(repo.cancelBooking).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: 'b-1', bookerId: 'booker' }),
      );
    });

    it('409s with the retry message when the transaction was busy', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.cancelBooking.mockResolvedValue({ kind: 'BUSY' });
      await expect(service.cancel('b-1', 'booker')).rejects.toThrow(
        new ConflictException(ErrorConstant.OPEN_PLAY_MESSAGES.BUSY),
      );
    });
  });

  // AC-08: membership is always looked up against the booking's own tenant
  // and venue. This mock behaves like the real table for one user who is
  // STAFF of a *different* tenant ('t-2'), so a 403 here proves the service
  // never lets another tenant's staff through. Task 8 checks the real query.
  describe('cross-tenant staff', () => {
    beforeEach(() => {
      repo.hasVenueStaffMembership.mockImplementation((userId, tenantId) =>
        Promise.resolve(userId === 'other-tenant-staff' && tenantId === 't-2'),
      );
    });

    it('403s enable for staff of another tenant', async () => {
      repo.findById.mockResolvedValue(
        booking({
          isOpenPlay: false,
          openPlayCapacity: null,
          openPlayJoinToken: null,
          isOpenPlayPublic: false,
        }),
      );
      await expect(
        service.enable('b-1', 'other-tenant-staff', {}),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.hasVenueStaffMembership).toHaveBeenCalledWith(
        'other-tenant-staff',
        't-1',
        'v-1',
      );
      expect(repo.enableOpenPlay).not.toHaveBeenCalled();
    });

    it('403s setVisibility for staff of another tenant', async () => {
      repo.findById.mockResolvedValue(booking());
      await expect(
        service.setVisibility('b-1', 'other-tenant-staff', { isPublic: true }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.hasVenueStaffMembership).toHaveBeenCalledWith(
        'other-tenant-staff',
        't-1',
        'v-1',
      );
      expect(repo.setVisibility).not.toHaveBeenCalled();
    });
  });

  describe('enable', () => {
    const privateBooking = () =>
      booking({
        isOpenPlay: false,
        openPlayCapacity: null,
        openPlayJoinToken: null,
        isOpenPlayPublic: false,
      });

    it('403s for the booker who is not staff (customers opt in only at creation)', async () => {
      repo.findById.mockResolvedValue(privateBooking());
      await expect(service.enable('b-1', 'booker', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('checks staff membership against the booking tenant and venue', async () => {
      repo.findById.mockResolvedValue(privateBooking());
      await expect(service.enable('b-1', 'staff', {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.hasVenueStaffMembership).toHaveBeenCalledWith(
        'staff',
        't-1',
        'v-1',
      );
    });

    it('enables with default capacity 4 and private, then returns the manage view', async () => {
      repo.findById
        .mockResolvedValueOnce(privateBooking())
        .mockResolvedValueOnce(
          booking({ isOpenPlayPublic: false, openPlayJoinToken: 'new-token' }),
        );
      repo.hasVenueStaffMembership.mockResolvedValue(true);
      repo.enableOpenPlay.mockResolvedValue({ kind: 'ENABLED' });

      const result = await service.enable('b-1', 'staff', {});

      expect(repo.enableOpenPlay).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'b-1',
          capacity: 4,
          isPublic: false,
          token: 'new-token',
        }),
      );
      expect(result.joinToken).toBe('new-token');
    });

    it('409s when already open play', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.hasVenueStaffMembership.mockResolvedValue(true);
      await expect(service.enable('b-1', 'staff', {})).rejects.toThrow(
        ConflictException,
      );
    });

    it('409s when the booking has no booker user', async () => {
      repo.findById.mockResolvedValue({ ...privateBooking(), userId: null });
      repo.hasVenueStaffMembership.mockResolvedValue(true);
      await expect(service.enable('b-1', 'staff', {})).rejects.toThrow(
        ConflictException,
      );
    });

    it('404s for an unknown booking', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.enable('b-1', 'staff', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('409s with the retry message when the transaction was busy', async () => {
      repo.findById.mockResolvedValue(privateBooking());
      repo.hasVenueStaffMembership.mockResolvedValue(true);
      repo.enableOpenPlay.mockResolvedValue({ kind: 'BUSY' });
      await expect(service.enable('b-1', 'staff', {})).rejects.toThrow(
        new ConflictException(ErrorConstant.OPEN_PLAY_MESSAGES.BUSY),
      );
    });
  });

  describe('setVisibility', () => {
    it('lets the booker toggle', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.setVisibility.mockResolvedValue(true);
      await service.setVisibility('b-1', 'booker', { isPublic: false });
      expect(repo.setVisibility).toHaveBeenCalledWith('b-1', false);
    });

    it('lets venue staff toggle', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.hasVenueStaffMembership.mockResolvedValue(true);
      repo.setVisibility.mockResolvedValue(true);
      await service.setVisibility('b-1', 'staff', { isPublic: true });
      expect(repo.setVisibility).toHaveBeenCalledWith('b-1', true);
    });

    it('403s for anyone else, including staff of another venue', async () => {
      repo.findById.mockResolvedValue(booking());
      await expect(
        service.setVisibility('b-1', 'stranger', { isPublic: true }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('409s on a booking that is not open play', async () => {
      repo.findById.mockResolvedValue(
        booking({
          isOpenPlay: false,
          openPlayCapacity: null,
          openPlayJoinToken: null,
        }),
      );
      await expect(
        service.setVisibility('b-1', 'booker', { isPublic: true }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getManageView', () => {
    it('returns the token and roster names to the booker', async () => {
      repo.findById.mockResolvedValue(booking());
      repo.findRoster.mockResolvedValue([
        {
          isBooker: true,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          user: { name: 'Bea' },
        },
      ]);
      const result = await service.getManageView('b-1', 'booker');
      expect(result.joinToken).toBe('tok');
      expect(result.roster).toEqual([
        { name: 'Bea', isBooker: true, joinedAt: '2026-10-01T00:00:00.000Z' },
      ]);
    });

    it('403s for a stranger', async () => {
      repo.findById.mockResolvedValue(booking());
      await expect(service.getManageView('b-1', 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
