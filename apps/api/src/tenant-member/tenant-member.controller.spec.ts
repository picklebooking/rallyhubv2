import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

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
    Object.values(mockTenantMemberService).forEach((mock) => mock.mockReset());

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantMemberController],
      providers: [
        {
          provide: TenantMemberService,
          useValue: mockTenantMemberService,
        },
      ],
    }).compile();

    controller = module.get<TenantMemberController>(TenantMemberController);

    service = module.get<TenantMemberService>(
      TenantMemberService,
    ) as jest.Mocked<TenantMemberService>;
  });

  describe('controller initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have the service injected', () => {
      expect(service).toBeDefined();
    });
  });

  describe('create', () => {
    const tenantId = 'tenant-1';

    const dto = {
      email: 'test@example.com',
      role: 'CUSTOMER',
    } as CreateTenantMemberDto;

    it('should create a tenant member', async () => {
      const result = {
        message: 'Created',
        content: { id: 'member-1' },
      };

      service.create.mockResolvedValue(
        result as Awaited<ReturnType<TenantMemberService['create']>>,
      );

      const response = await controller.create(tenantId, dto);

      expect(response).toEqual(result);
      expect(service.create).toHaveBeenCalledWith(tenantId, dto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if member already exists', async () => {
      service.create.mockRejectedValue(
        new ConflictException('Tenant member already exists'),
      );

      await expect(controller.create(tenantId, dto)).rejects.toThrow(
        ConflictException,
      );

      expect(service.create).toHaveBeenCalledWith(tenantId, dto);
    });

    it('should propagate BadRequestException', async () => {
      service.create.mockRejectedValue(
        new BadRequestException('Invalid member data'),
      );

      await expect(controller.create(tenantId, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it('should propagate ForbiddenException', async () => {
      service.create.mockRejectedValue(new ForbiddenException('Access denied'));

      await expect(controller.create(tenantId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    const tenantId = 'tenant-1';

    it('should return all tenant members', async () => {
      const result = {
        message: 'Members found',
        content: [{ id: 'member-1' }, { id: 'member-2' }],
      };

      service.findAll.mockResolvedValue(
        result as Awaited<ReturnType<TenantMemberService['findAll']>>,
      );

      const response = await controller.findAll(tenantId);

      expect(response).toEqual(result);
      expect(service.findAll).toHaveBeenCalledWith(tenantId);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return an empty list when no members exist', async () => {
      const result = {
        message: 'No members found',
        content: [],
      };

      service.findAll.mockResolvedValue(
        result as Awaited<ReturnType<TenantMemberService['findAll']>>,
      );

      const response = await controller.findAll(tenantId);

      expect(response).toEqual(result);
      expect(response.content).toEqual([]);
      expect(service.findAll).toHaveBeenCalledWith(tenantId);
    });

    it('should propagate NotFoundException if tenant does not exist', async () => {
      service.findAll.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      await expect(controller.findAll(tenantId)).rejects.toThrow(
        NotFoundException,
      );

      expect(service.findAll).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('findOne', () => {
    const tenantId = 'tenant-1';
    const userId = 'member-1';

    it('should return a tenant member', async () => {
      const result = {
        message: 'Member found',
        content: { id: userId },
      };

      service.findOne.mockResolvedValue(
        result as Awaited<ReturnType<TenantMemberService['findOne']>>,
      );

      const response = await controller.findOne(tenantId, userId);

      expect(response).toEqual(result);
      expect(service.findOne).toHaveBeenCalledWith(tenantId, userId);
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if member does not exist', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Tenant member not found'),
      );

      await expect(
        controller.findOne(tenantId, 'non-existing-member'),
      ).rejects.toThrow(NotFoundException);

      expect(service.findOne).toHaveBeenCalledWith(
        tenantId,
        'non-existing-member',
      );
    });

    it('should propagate ForbiddenException', async () => {
      service.findOne.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(controller.findOne(tenantId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    const id = 'member-1';
    const tenantId = 'tenant-1';

    const dto = {
      role: 'STAFF',
    } as UpdateTenantMemberDto;

    it('should update a tenant member', async () => {
      const result = {
        message: 'Updated',
        content: { id },
      };

      service.update.mockResolvedValue(
        result as Awaited<ReturnType<TenantMemberService['update']>>,
      );

      const response = await controller.update(id, tenantId, dto);

      expect(response).toEqual(result);
      expect(service.update).toHaveBeenCalledWith(id, tenantId, dto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if member does not exist', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Tenant member not found'),
      );

      await expect(controller.update(id, tenantId, dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(service.update).toHaveBeenCalledWith(id, tenantId, dto);
    });

    it('should propagate ConflictException', async () => {
      service.update.mockRejectedValue(
        new ConflictException('Member update conflict'),
      );

      await expect(controller.update(id, tenantId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should propagate BadRequestException', async () => {
      service.update.mockRejectedValue(
        new BadRequestException('Invalid update data'),
      );

      await expect(controller.update(id, tenantId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    const id = 'member-1';
    const tenantId = 'tenant-1';

    it('should remove a tenant member', async () => {
      const result = {
        message: 'Deleted',
        content: { id },
      };

      service.remove.mockResolvedValue(
        result as Awaited<ReturnType<TenantMemberService['remove']>>,
      );

      const response = await controller.remove(id, tenantId);

      expect(response).toEqual(result);
      expect(service.remove).toHaveBeenCalledWith(id, tenantId);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if member does not exist', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Tenant member not found'),
      );

      await expect(controller.remove(id, tenantId)).rejects.toThrow(
        NotFoundException,
      );

      expect(service.remove).toHaveBeenCalledWith(id, tenantId);
    });

    it('should propagate ForbiddenException', async () => {
      service.remove.mockRejectedValue(new ForbiddenException('Access denied'));

      await expect(controller.remove(id, tenantId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should propagate ConflictException', async () => {
      service.remove.mockRejectedValue(
        new ConflictException('Cannot remove member'),
      );

      await expect(controller.remove(id, tenantId)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
