import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantMemberController } from './tenant-member.controller';
import { TenantMemberService } from './tenant-member.service';

describe('TenantMemberController', () => {
  let controller: TenantMemberController;
  let service: jest.Mocked<TenantMemberService>;

  const mockTenantMemberService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
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
      const dto = {
        email: 'test@example.com',
        role: 'ADMIN',
        tenantId: 'tenant-1',
      };

      const result = {
        message: 'Created',
        content: { id: 'member-1' },
      };

      service.create.mockResolvedValue(result as any);

      expect(await controller.create(dto as any)).toEqual(result);
      expect(service.create).toHaveBeenCalledWith(dto);
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
    });
  });

  describe('findOne', () => {
    it('should return a tenant member', async () => {
      const id = 'member-1';
      const result = {
        message: 'Member found',
        content: { id },
      };

      service.findOne.mockResolvedValue(result as any);

      expect(await controller.findOne(id)).toEqual(result);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('update', () => {
    it('should update a tenant member', async () => {
      const id = 'member-1';
      const dto = { role: 'ADMIN' };
      const result = {
        message: 'Updated',
        content: { id },
      };

      service.update.mockResolvedValue(result as any);

      expect(await controller.update(id, dto as any)).toEqual(result);
      expect(service.update).toHaveBeenCalledWith(id, dto);
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
    });
  });
});
