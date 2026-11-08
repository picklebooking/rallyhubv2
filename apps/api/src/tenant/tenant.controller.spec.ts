import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TenantAdminThrottlerGuard } from '../common/guards/tenant-admin-throttler.guard';
import { TenantStatus } from '../generated/prisma/enums';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

describe('TenantController', () => {
  let controller: TenantController;

  const session = { user: { id: 'actor' } } as unknown as UserSession;
  const tenantService = {
    createTenant: jest.fn(),
    updateTenantStatus: jest.fn(),
    deleteTenantById: jest.fn(),
    updateTenantData: jest.fn(),
    readTenantById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        {
          provide: TenantService,
          useValue: tenantService,
        },
      ],
    })
      .overrideGuard(TenantAdminThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TenantController>(TenantController);
  });

  it.each([
    ['createTenantRoute', true],
    ['updateTenantStatusRoute', true],
    ['deleteTenantByIdRoute', true],
    ['updateTenantDataRoute', false],
    ['findTenantByIdRoute', false],
  ] as const)(
    'applies the per-user tenant admin limit to %s: %s',
    (handler, limited) => {
      const guards = (Reflect.getMetadata(
        GUARDS_METADATA,
        TenantController.prototype[handler],
      ) ?? []) as unknown[];
      expect(guards.includes(TenantAdminThrottlerGuard)).toBe(limited);
    },
  );

  it('forwards the authenticated actor for every tenant write', async () => {
    const payload = {
      email: 'tenant@example.com',
      tenantName: 'Tenant',
      phone: '123',
    };
    await controller.createTenantRoute(session, payload);
    expect(tenantService.createTenant).toHaveBeenCalledWith('actor', payload);
    await controller.updateTenantStatusRoute(session, 'tenant', {
      status: TenantStatus.ACTIVE,
    });
    expect(tenantService.updateTenantStatus).toHaveBeenCalledWith(
      'actor',
      'tenant',
      { status: TenantStatus.ACTIVE },
    );
    await controller.deleteTenantByIdRoute(session, 'tenant');
    expect(tenantService.deleteTenantById).toHaveBeenCalledWith(
      'actor',
      'tenant',
    );
    await controller.updateTenantDataRoute(session, 'tenant', payload);
    expect(tenantService.updateTenantData).toHaveBeenCalledWith(
      'actor',
      'tenant',
      payload,
    );
  });

  it('forwards the authenticated actor and status filter for tenant reads', async () => {
    await controller.findTenantByIdRoute(session, 'tenant', {
      status: TenantStatus.ACTIVE,
    });
    expect(tenantService.readTenantById).toHaveBeenCalledWith(
      'actor',
      'tenant',
      TenantStatus.ACTIVE,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
