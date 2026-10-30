import { jest } from '@jest/globals';
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

    controller = module.get<TenantMemberController>(TenantMemberController);

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
  });

  describe('update', () => {
    it('should update a tenant member', async () => {
      const id = 'member-1';

      const dto = {
        role: 'STAFF',
      } as UpdateTenantMemberDto;

      const result = {
        message: 'Updated',
        content: { id },
      };

      service.update.mockResolvedValue(result as any);

      expect(await controller.update(id, dto)).toEqual(result);

      expect(service.update).toHaveBeenCalledWith(id, dto);

      expect(service.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should remove a tenant member', async () => {
      const id = 'member-1';

      const result = {
        message: 'Deleted',
        content: { id },
      };

      service.remove.mockResolvedValue(result as any);

      expect(await controller.remove(id)).toEqual(result);

      expect(service.remove).toHaveBeenCalledWith(id);

      expect(service.remove).toHaveBeenCalledTimes(1);
    });
  });
});
