import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommonConstants } from '../constants/common.constant';
import { ErrorConstant } from '../constants/error-code.constant';
import { TenantRole } from '../generated/prisma/enums';
import { TenantMemberRepository } from './tenant-member.repository';
import { TenantMemberService } from './tenant-member.service';

describe('TenantMemberService', () => {
  let service: TenantMemberService;
  let repository: jest.Mocked<TenantMemberRepository>;

  const mockTenantMemberRepository = {
    getValidMember: jest.fn(),
    create: jest.fn(),
    getTenantMember: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const userId = 'user-1';
  const tenantId = 'tenant-1';
  const memberId = 'member-1';

  const role = Object.values(TenantRole)[0] as TenantRole;

  const mockMember = {
    id: memberId,
    userId,
    tenantId,
    role,
    venueId: 'venue-1',
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMemberService,
        {
          provide: TenantMemberRepository,
          useValue: mockTenantMemberRepository,
        },
      ],
    }).compile();

    service = module.get<TenantMemberService>(TenantMemberService);

    repository = module.get(TenantMemberRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = {
      email: 'test@example.com',
      role,
      tenantId,
      venueId: 'venue-1',
    };

    it('should create a tenant member successfully', async () => {
      repository.getValidMember.mockResolvedValue({
        existingUser: [{ id: userId }] as any,
        tenantMembers: [],
      });

      repository.create.mockResolvedValue(mockMember as any);

      const result = await service.create(dto);

      expect(repository.getValidMember).toHaveBeenCalledWith(dto.email);

      expect(repository.create).toHaveBeenCalledWith(
        userId,
        dto.role,
        dto.tenantId,
        dto.venueId,
      );

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.CREATED,
        content: mockMember,
      });
    });

    it('should throw ConflictException if member already exists', async () => {
      repository.getValidMember.mockResolvedValue({
        existingUser: [{ id: userId }] as any,
        tenantMembers: [mockMember] as any,
      });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all tenant members', async () => {
      const members = [mockMember];

      repository.getTenantMember.mockResolvedValue(members as any);

      const result = await service.findAll(tenantId);

      expect(repository.getTenantMember).toHaveBeenCalledWith(
        CommonConstants.SEPARATOR.EMPTY_STRING,
        tenantId,
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
  });

  describe('findOne', () => {
    it('should return a tenant member', async () => {
      repository.getTenantMember.mockResolvedValue(mockMember as any);

      const result = await service.findOne(memberId);

      expect(repository.getTenantMember).toHaveBeenCalledWith(memberId);

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.FOUND,
        content: mockMember,
      });
    });

    it('should throw NotFoundException if member does not exist', async () => {
      repository.getTenantMember.mockResolvedValue(null as any);

      await expect(service.findOne(memberId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const dto = {
      role,
      venueId: 'venue-2',
    };

    it('should update a tenant member successfully', async () => {
      const updatedMember = {
        ...mockMember,
        ...dto,
      };

      repository.getTenantMember.mockResolvedValue(mockMember as any);

      repository.update.mockResolvedValue(updatedMember as any);

      const result = await service.update(memberId, dto);

      expect(repository.getTenantMember).toHaveBeenCalledWith(memberId);

      expect(repository.update).toHaveBeenCalledWith(
        memberId,
        dto.role,
        dto.venueId,
      );

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.UPDATED,
        content: updatedMember,
      });
    });

    it('should throw NotFoundException if member does not exist', async () => {
      repository.getTenantMember.mockResolvedValue(null as any);

      await expect(service.update(memberId, dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.update).not.toHaveBeenCalled();
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

      const result = await service.remove(memberId);

      expect(repository.getTenantMember).toHaveBeenCalledWith(memberId);

      expect(repository.delete).toHaveBeenCalledWith(memberId);

      expect(result).toEqual({
        message: ErrorConstant.TENANT_MEMBER_MESSAGES.DELETED,
        content: deletedMember,
      });
    });

    it('should throw NotFoundException if member does not exist', async () => {
      repository.getTenantMember.mockReturnValue(null as any);

      await expect(service.remove(memberId)).rejects.toThrow(NotFoundException);

      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
