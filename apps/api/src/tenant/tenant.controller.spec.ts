import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import type { UserSession } from '@thallesp/nestjs-better-auth';
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
    }).compile();

    controller = module.get<TenantController>(TenantController);
  });

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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
