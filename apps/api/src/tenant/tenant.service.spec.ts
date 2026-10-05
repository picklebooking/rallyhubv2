import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantStatus } from '../generated/prisma/enums';
import { ITenant } from '../interface/ITenant.interface';
import { TenantRepository } from './tenant.repository';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;

const tenantRepository = {
  findById: jest.fn<
    (tenantId: string, status: TenantStatus) => Promise<ITenant | null>
  >(),
  create: jest.fn(),
};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
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

  it('throws NotFoundException when the tenant does not exist', async () => {
    tenantRepository.findById.mockResolvedValue(null);

    await expect(
      service.findTenantById(
        'missing-id',
        TenantStatus.ACTIVE,
        false,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(tenantRepository.findById).toHaveBeenCalledWith(
      'missing-id',
      TenantStatus.ACTIVE,
    );
  });
});