import { jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from '../authorization/authorization.service';
import { TenantStatus } from '../generated/prisma/enums';
import { ITenant } from '../interface/ITenant.interface';
import { TenantRepository } from './tenant.repository';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

  const tenantRepository = {
    findById:
      jest.fn<
        (tenantId: string, status: TenantStatus) => Promise<ITenant | null>
      >(),
    create: jest.fn(),
  };

  const authorizationService = {
    assertPlatformAdmin: jest.fn<() => Promise<void>>(),
    assertCanEditTenant: jest.fn<() => Promise<void>>(),
    assertCanReadTenant:
      jest.fn<(userId: string, tenantId: string) => Promise<void>>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: AuthorizationService, useValue: authorizationService },
        {
          provide: TenantRepository,
          useValue: tenantRepository,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each(['status', 'delete', 'details'] as const)(
    'checks existence before permission for %s',
    async (operation) => {
      tenantRepository.findById.mockResolvedValue(null);
      const result =
        operation === 'status'
          ? service.updateTenantStatus('actor', 'missing', {
              status: TenantStatus.ACTIVE,
            })
          : operation === 'delete'
            ? service.deleteTenantById('actor', 'missing')
            : service.updateTenantData('actor', 'missing', {
                tenantName: 'Update',
              });
      await expect(result).rejects.toThrow(NotFoundException);
      expect(authorizationService.assertPlatformAdmin).not.toHaveBeenCalled();
      expect(authorizationService.assertCanEditTenant).not.toHaveBeenCalled();
    },
  );

  it('throws NotFoundException when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      service.findTenantById('missing-id', TenantStatus.ACTIVE, false),
    ).rejects.toThrow(NotFoundException);

    expect(tenantRepository.findById).toHaveBeenCalledWith(
      'missing-id',
      TenantStatus.ACTIVE,
    );
  });

  describe('readTenantById', () => {
    it('checks read access before touching the repository', async () => {
      authorizationService.assertCanReadTenant.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(
        service.readTenantById('actor', 'tenant', TenantStatus.ACTIVE),
      ).rejects.toThrow(ForbiddenException);
      expect(authorizationService.assertCanReadTenant).toHaveBeenCalledWith(
        'actor',
        'tenant',
      );
      expect(tenantRepository.findById).not.toHaveBeenCalled();
    });

    it('returns the wrapped tenant when allowed', async () => {
      authorizationService.assertCanReadTenant.mockResolvedValue(undefined);
      const tenant = { id: 'tenant' } as ITenant;
      tenantRepository.findById.mockResolvedValue(tenant);
      await expect(
        service.readTenantById('actor', 'tenant', TenantStatus.ACTIVE),
      ).resolves.toMatchObject({ success: true, data: tenant });
      expect(tenantRepository.findById).toHaveBeenCalledWith(
        'tenant',
        TenantStatus.ACTIVE,
      );
    });

    it('throws NotFoundException for an allowed actor and unknown tenant', async () => {
      authorizationService.assertCanReadTenant.mockResolvedValue(undefined);
      tenantRepository.findById.mockResolvedValue(null);
      await expect(service.readTenantById('actor', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
