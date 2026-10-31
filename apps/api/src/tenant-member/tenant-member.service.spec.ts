
import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CommonConstants } from '../constants/common.constant';
import { ErrorConstant } from '../constants/error-code.constant';
import { TenantRole } from '../generated/prisma/enums';
import { TenantRepository } from '../tenant/tenant.repository';
import { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import { TenantMemberRepository } from './tenant-member.repository';
import { TenantMemberService } from './tenant-member.service';

describe('TenantMemberService', () => {
  let service: TenantMemberService;
  let repository: typeof mockTenantMemberRepository;
  let tenantRepository: typeof mockTenantRepository;

  const mockTenantMemberRepository = {
    getValidMember: jest.fn<TenantMemberRepository['getValidMember']>(),
    findInactive: jest.fn<TenantMemberRepository['findInactive']>(),
    reactivate: jest.fn<TenantMemberRepository['reactivate']>(),
    create: jest.fn<TenantMemberRepository['create']>(),
    getTenantMember: jest.fn<TenantMemberRepository['getTenantMember']>(),
    update: jest.fn<TenantMemberRepository['update']>(),
    delete: jest.fn<TenantMemberRepository['delete']>(),
  };

  const mockTenantRepository = {
    findById: jest.fn<TenantRepository['findById']>(),
  };

  const userId = 'user-1';
  const tenantId = 'tenant-1';
  const memberId = 'member-1';
  const venueId = 'venue-1';
  const role = Object.values(TenantRole)[0] as TenantRole;

  const mockMember = {
    id: memberId,
    userId,
    tenantId,
    role,
    venueId,
    isActive: true,
  };

  const mockInactiveMember = {
    ...mockMember,
    isActive: false,
  };

  const mockExistingUser = { id: userId };
  const mockTenant = { id: tenantId };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMemberService,
        {
          provide: TenantMemberRepository,
          useValue: mockTenantMemberRepository,
        },
        {
          provide: TenantRepository,
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<TenantMemberService>(TenantMemberService);
    repository = module.get(TenantMemberRepository);
    tenantRepository = module.get(TenantRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      email: 'test@example.com',
      role,
      venueId,
    } as CreateTenantMemberDto;

    const mockValidUser = () => {
      repository.getValidMember.mockResolvedValue({
        existingUser: [mockExistingUser] as any,
        tenantMembers: [],
      });

      repository.findInactive.mockResolvedValue(null as any);
      tenantRepository.findById.mockResolvedValue(mockTenant as any);
    };

    it('should create a tenant member successfully when tenant exists', async () => {
      mockValidUser();
      repository.create.mockResolvedValue(mockMember as any);

      const result = await service.create(tenantId, dto);

      expect(repository.getValidMember).toHaveBeenCalledWith(dto.email);
      expect(repository.findInactive).toHaveBeenCalledWith(
        userId,
        tenantId,
      );
      expect(tenantRepository.findById).toHaveBeenCalledWith(tenantId);
      expect(repository.create).toHaveBeenCalledWith(
        userId,
        dto.role,
        tenantId,
        dto.venueId,
      );
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.reactivate).not.toHaveBeenCalled();

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.CREATED,
        content: mockMember,
      });
    });

    it('should reactivate an inactive tenant member without checking the tenant', async () => {
      mockValidUser();

      repository.findInactive.mockResolvedValue(
        mockInactiveMember as any,
      );
      repository.reactivate.mockResolvedValue(mockMember as any);

      const result = await service.create(tenantId, dto);

      expect(repository.reactivate).toHaveBeenCalledWith(
        userId,
        tenantId,
      );
      expect(repository.reactivate).toHaveBeenCalledTimes(1);
      expect(tenantRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.REACTIVATE,
        content: mockMember,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      repository.getValidMember.mockResolvedValue({
        existingUser: [],
        tenantMembers: [],
      });

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        new NotFoundException(
          ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
        ),
      );

      expect(repository.findInactive).not.toHaveBeenCalled();
      expect(tenantRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.reactivate).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if member already exists', async () => {
      repository.getValidMember.mockResolvedValue({
        existingUser: [mockExistingUser] as any,
        tenantMembers: [mockMember] as any,
      });

      repository.findInactive.mockResolvedValue(null as any);

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        new ConflictException(
          ErrorConstant.TENANT_MEMBER_MESSAGES.ALREADY_EXISTS,
        ),
      );

      expect(tenantRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.reactivate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if tenant does not exist', async () => {
      mockValidUser();
      tenantRepository.findById.mockResolvedValue(null as any);

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        new NotFoundException(
          ErrorConstant.TENANT_MESSAGES.NOT_FOUND,
        ),
      );

      expect(tenantRepository.findById).toHaveBeenCalledWith(tenantId);
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.reactivate).not.toHaveBeenCalled();
    });

    it('should allow creation if existing members belong to other users', async () => {
      const otherMember = {
        ...mockMember,
        id: 'member-2',
        userId: 'user-2',
      };

      repository.getValidMember.mockResolvedValue({
        existingUser: [mockExistingUser] as any,
        tenantMembers: [otherMember] as any,
      });

      repository.findInactive.mockResolvedValue(null as any);
      tenantRepository.findById.mockResolvedValue(mockTenant as any);
      repository.create.mockResolvedValue(mockMember as any);

      const result = await service.create(tenantId, dto);

      expect(tenantRepository.findById).toHaveBeenCalledWith(tenantId);
      expect(repository.create).toHaveBeenCalledWith(
        userId,
        dto.role,
        tenantId,
        dto.venueId,
      );

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.CREATED,
        content: mockMember,
      });
    });

    it('should propagate errors during user validation', async () => {
      repository.getValidMember.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        'Database error',
      );

      expect(repository.findInactive).not.toHaveBeenCalled();
      expect(tenantRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should propagate errors during inactive member lookup', async () => {
      mockValidUser();

      repository.findInactive.mockRejectedValue(
        new Error('Inactive member lookup failed'),
      );

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        'Inactive member lookup failed',
      );

      expect(tenantRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.reactivate).not.toHaveBeenCalled();
    });

    it('should propagate errors during tenant lookup', async () => {
      mockValidUser();

      tenantRepository.findById.mockRejectedValue(
        new Error('Tenant lookup failed'),
      );

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        'Tenant lookup failed',
      );

      expect(tenantRepository.findById).toHaveBeenCalledWith(tenantId);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should propagate errors during member creation', async () => {
      mockValidUser();

      repository.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        'Database error',
      );

      expect(tenantRepository.findById).toHaveBeenCalledWith(tenantId);
      expect(repository.create).toHaveBeenCalledWith(
        userId,
        dto.role,
        tenantId,
        dto.venueId,
      );
    });

    it('should propagate errors during member reactivation', async () => {
      mockValidUser();

      repository.findInactive.mockResolvedValue(
        mockInactiveMember as any,
      );

      repository.reactivate.mockRejectedValue(
        new Error('Reactivation failed'),
      );

      await expect(service.create(tenantId, dto)).rejects.toThrow(
        'Reactivation failed',
      );

      expect(repository.reactivate).toHaveBeenCalledWith(
        userId,
        tenantId,
      );

      expect(tenantRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all tenant members', async () => {
      const members = [mockMember];

      repository.getTenantMember.mockResolvedValue(members as any);

      const result = await service.findAll(tenantId);

      expect(repository.getTenantMember).toHaveBeenCalledWith(
        tenantId,
        CommonConstants.SEPARATOR.EMPTY_STRING,
        true,
      );

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.LIST_FOUND,
        content: members,
      });
    });

    it('should throw NotFoundException if no members exist', async () => {
      repository.getTenantMember.mockResolvedValue([] as any);

      await expect(service.findAll(tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if repository returns null', async () => {
      repository.getTenantMember.mockResolvedValue(null as any);

      await expect(service.findAll(tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate repository errors', async () => {
      repository.getTenantMember.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findAll(tenantId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findOne', () => {
    it('should return a tenant member', async () => {
      repository.getTenantMember.mockResolvedValue(mockMember as any);

      const result = await service.findOne(tenantId, userId);

      expect(repository.getTenantMember).toHaveBeenCalledWith(
        tenantId,
        userId,
      );

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.FOUND,
        content: mockMember,
      });
    });

    it('should throw NotFoundException if member does not exist', async () => {
      repository.getTenantMember.mockResolvedValue(null as any);

      await expect(
        service.findOne(tenantId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate repository errors', async () => {
      repository.getTenantMember.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.findOne(tenantId, userId),
      ).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const dto = {
      role,
      venueId: 'venue-2',
    } as UpdateTenantMemberDto;

    it('should update a tenant member successfully', async () => {
      const updatedMember = {
        ...mockMember,
        ...dto,
      };

      repository.getTenantMember.mockResolvedValue(mockMember as any);
      repository.update.mockResolvedValue(updatedMember as any);

      const result = await service.update(memberId, tenantId, dto);

      expect(repository.getTenantMember).toHaveBeenCalledWith(
        memberId,
        tenantId,
      );

      expect(repository.update).toHaveBeenCalledWith(
        memberId,
        dto.role,
        dto.venueId,
      );

      expect(repository.update).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.UPDATED,
        content: updatedMember,
      });
    });

    it('should throw NotFoundException if member does not exist', async () => {
      repository.getTenantMember.mockResolvedValue(null as any);

      await expect(
        service.update(memberId, tenantId, dto),
      ).rejects.toThrow(NotFoundException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should propagate errors during member lookup', async () => {
      repository.getTenantMember.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.update(memberId, tenantId, dto),
      ).rejects.toThrow('Database error');

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should propagate errors during update', async () => {
      repository.getTenantMember.mockResolvedValue(mockMember as any);

      repository.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.update(memberId, tenantId, dto),
      ).rejects.toThrow('Database error');

      expect(repository.update).toHaveBeenCalledWith(
        memberId,
        dto.role,
        dto.venueId,
      );
    });
  });

  describe('remove', () => {
    it('should soft-delete a tenant member successfully', async () => {
      const deletedMember = {
        ...mockMember,
        isActive: false,
      };

      repository.getTenantMember.mockResolvedValue(mockMember as any);
      repository.delete.mockResolvedValue(deletedMember as any);

      const result = await service.remove(memberId, tenantId);

      expect(repository.getTenantMember).toHaveBeenCalledWith(
        memberId,
        tenantId,
      );

      expect(repository.delete).toHaveBeenCalledWith(memberId);
      expect(repository.delete).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.DELETED,
        content: deletedMember,
      });
    });

    it('should throw NotFoundException if member does not exist', async () => {
      repository.getTenantMember.mockResolvedValue(null as any);

      await expect(
        service.remove(memberId, tenantId),
      ).rejects.toThrow(NotFoundException);

      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('should propagate errors during member lookup', async () => {
      repository.getTenantMember.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.remove(memberId, tenantId),
      ).rejects.toThrow('Database error');

      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('should propagate errors during deletion', async () => {
      repository.getTenantMember.mockResolvedValue(mockMember as any);

      repository.delete.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.remove(memberId, tenantId),
      ).rejects.toThrow('Database error');

      expect(repository.delete).toHaveBeenCalledWith(memberId);
    });
  });
});
