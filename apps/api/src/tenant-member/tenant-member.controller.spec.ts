
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import { TenantMemberController } from './tenant-member.controller';
import { TenantMemberService } from './tenant-member.service';

describe('TenantMemberController', () => {
  let controller: TenantMemberController;
  let service: jest.Mocked<TenantMemberService>;

  const mockTenantMemberService = {
    create: jest.fn<TenantMemberService['create']>(),
    findAll: jest.fn<TenantMemberService['findAll']>(),
    findOne: jest.fn<TenantMemberService['findOne']>(),
    update: jest.fn<TenantMemberService['update']>(),
    remove: jest.fn<TenantMemberService['remove']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantMemberController],
      providers: [
        {
          provide: TenantMemberService,
          useValue: mockTenantMemberService,
        },
      ],
    }).compile();

    controller = module.get<TenantMemberController>(
      TenantMemberController,
    );

    service = module.get(TenantMemberService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a tenant member', async () => {
      const tenantId = 'tenant-1';

      const dto = {
        email: 'test@example.com',
        role: 'CUSTOMER',
      } as CreateTenantMemberDto;

      const result = {
        message: 'Created',
        content: { id: 'member-1' },
      };

      service.create.mockResolvedValue(result as any);

      expect(await controller.create(tenantId, dto)).toEqual(result);

      expect(service.create).toHaveBeenCalledWith(tenantId, dto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if member already exists', async () => {
      const tenantId = 'tenant-1';

      const dto = {
        email: 'existing@example.com',
        role: 'CUSTOMER',
      } as CreateTenantMemberDto;

      service.create.mockRejectedValue(
        new ConflictException('Tenant member already exists'),
      );

      await expect(controller.create(tenantId, dto)).rejects.toThrow(
        ConflictException,
      );

      expect(service.create).toHaveBeenCalledWith(tenantId, dto);
    });
  });

  describe('findAll', () => {
    it('should return all tenant members', async () => {
      const tenantId = 'tenant-1';

      const result = {
        message: 'Members found',
        content: [{ id: 'member-1' }],
      };

      service.findAll.mockResolvedValue(result as any);

      expect(await controller.findAll(tenantId)).toEqual(result);

      expect(service.findAll).toHaveBeenCalledWith(tenantId);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return an empty list when no members exist', async () => {
      const tenantId = 'tenant-1';

      const result = {
        message: 'No members found',
        content: [],
      };

      service.findAll.mockResolvedValue(result as any);

      expect(await controller.findAll(tenantId)).toEqual(result);

      expect(service.findAll).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('findOne', () => {
    it('should return a tenant member', async () => {
      const tenantId = 'tenant-1';
      const userId = 'member-1';

      const result = {
        message: 'Member found',
        content: { id: userId },
      };

      service.findOne.mockResolvedValue(result as any);

      expect(await controller.findOne(tenantId, userId)).toEqual(result);

      expect(service.findOne).toHaveBeenCalledWith(tenantId, userId);
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if member does not exist', async () => {
      const tenantId = 'tenant-1';
      const userId = 'non-existing-member';

      service.findOne.mockRejectedValue(
        new NotFoundException('Tenant member not found'),
      );

      await expect(
        controller.findOne(tenantId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(service.findOne).toHaveBeenCalledWith(tenantId, userId);
    });
  });

  describe('update', () => {
    it('should update a tenant member', async () => {
      const id = 'member-1';
      const tenantId = 'tenant-1';

      const dto = {
        role: 'STAFF',
      } as UpdateTenantMemberDto;

      const result = {
        message: 'Updated',
        content: { id },
      };

      service.update.mockResolvedValue(result as any);

      expect(await controller.update(id, tenantId, dto)).toEqual(result);

      expect(service.update).toHaveBeenCalledWith(
        id,
        tenantId,
        dto,
      );

      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if member does not exist', async () => {
      const id = 'non-existing-member';
      const tenantId = 'tenant-1';

      const dto = {
        role: 'STAFF',
      } as UpdateTenantMemberDto;

      service.update.mockRejectedValue(
        new NotFoundException('Tenant member not found'),
      );

      await expect(
        controller.update(id, tenantId, dto),
      ).rejects.toThrow(NotFoundException);

      expect(service.update).toHaveBeenCalledWith(
        id,
        tenantId,
        dto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a tenant member', async () => {
      const id = 'member-1';
      const tenantId = 'tenant-1';

      const result = {
        message: 'Deleted',
        content: { id },
      };

      service.remove.mockResolvedValue(result as any);

      expect(await controller.remove(id, tenantId)).toEqual(result);

      expect(service.remove).toHaveBeenCalledWith(id, tenantId);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if member does not exist', async () => {
      const id = 'non-existing-member';
      const tenantId = 'tenant-1';

      service.remove.mockRejectedValue(
        new NotFoundException('Tenant member not found'),
      );

      await expect(
        controller.remove(id, tenantId),
      ).rejects.toThrow(NotFoundException);

      expect(service.remove).toHaveBeenCalledWith(id, tenantId);
    });
  });
});
