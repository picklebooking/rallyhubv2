import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommonConstants } from '../constants/common.constant';
import { ErrorConstant } from '../constants/error-code.constant';
import {
  ITenantGeneric,
  ITenantMember,
} from '../interface/ITenantMember.interface';
import { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import { UpdateTenantMemberDto } from './dto/update-tenant-member.dto';
import { TenantMemberRepository } from './tenant-member.repository';

@Injectable()
export class TenantMemberService {
  /**
   * Constructs and injects needed services for `TenaantMemberService`.
   *
   * @param {TenantMemberRepository} tenantMemberRepository Service responsible for interacting with database.
   */
  constructor(
    private readonly tenantMemberRepository: TenantMemberRepository,
  ) {}

  /**
   * Service responsible for creating a Tenant Member entry.
   *
   * @param    {CreateTenantMemberDto}    createTenantMemberDto
   * @returns  {Promise<ITenantMember<ITenantGeneric>>}
   */
  public async create(
    createTenantMemberDto: CreateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    const { email, role, venueId, tenantId } = createTenantMemberDto;

    const { existingUser, tenantMembers } =
      await this.tenantMemberRepository.getValidMember(email);

    if (
      tenantMembers.some(
        (member) =>
          existingUser[CommonConstants.NUMERIC.ZERO].id === member.userId,
      )
    )
      throw new ConflictException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.ALREADY_EXISTS,
      );

    const created = await this.tenantMemberRepository.create(
      existingUser[CommonConstants.NUMERIC.ZERO].id,
      role,
      tenantId,
      venueId,
    );

    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.CREATED,
      content: created,
    };
  }

  /**
   * Finds all members in a specific tenant.
   *
   * @param    {string}                                                     tenantId Tenant identifier.
   * @returns  {Promise<ITenantMember<ITenantGeneric[] | ITenantGeneric>>}           All of the members of a tenant.
   */
  public async findAll(
    tenantId: string,
  ): Promise<ITenantMember<ITenantGeneric[] | ITenantGeneric>> {
    const allTenantMembers = await this.tenantMemberRepository.getTenantMember(
      CommonConstants.SEPARATOR.EMPTY_STRING,
      tenantId,
      true,
    );

    if (
      !allTenantMembers ||
      (Array.isArray(allTenantMembers) && !allTenantMembers.length)
    )
      throw new NotFoundException(ErrorConstant.TENANT_MEMBER_MESSAGES.EMPTY);

    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.LIST_FOUND,
      content: allTenantMembers,
    };
  }

  /**
   * Finds a single unique member.
   *
   * @param    {string}                                                      id  A member's identifier.
   * @returns  {Promise<ITenantMember<ITenantGeneric | ITenantGeneric[]>>}       The single unique member.
   */
  public async findOne(
    id: string,
  ): Promise<ITenantMember<ITenantGeneric | ITenantGeneric[]>> {
    const uniqueTenantMember =
      await this.tenantMemberRepository.getTenantMember(id);

    if (!uniqueTenantMember)
      throw new NotFoundException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
      );

    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.FOUND,
      content: uniqueTenantMember,
    };
  }

  /**
   * Updates an entry of a member.
   *
   * @param    {string}                                  id                      A member's identifier.
   * @param    {UpdateTenantMemberDto}                   updateTenantMemberDto   An object that contains new data.
   * @returns  {Promise<ITenantMember<ITenantGeneric>>}                          The updated data of a member.
   */
  public async update(
    id: string,
    updateTenantMemberDto: UpdateTenantMemberDto,
  ): Promise<ITenantMember<ITenantGeneric>> {
    const { role, venueId } = updateTenantMemberDto;
    const tenantMember = await this.tenantMemberRepository.getTenantMember(id);

    if (!tenantMember)
      throw new NotFoundException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
      );

    const update = await this.tenantMemberRepository.update(id, role, venueId);

    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.UPDATED,
      content: update,
    };
  }

  /**
   * Method that soft-deletes a member from the Tenant Member table.
   *
   * @param    {string}                                 id  A member's identifier.
   * @returns  {Promise<ITenantMember<ITenantGeneric>>}     The removed data of a member.
   */
  public async remove(id: string): Promise<ITenantMember<ITenantGeneric>> {
    const tenantMember = this.tenantMemberRepository.getTenantMember(id);

    if (!tenantMember)
      throw new NotFoundException(
        ErrorConstant.TENANT_MEMBER_MESSAGES.NOT_FOUND,
      );

    const deleted = await this.tenantMemberRepository.delete(id);

    return {
      message: ErrorConstant.TENANT_MEMBER_MESSAGES.DELETED,
      content: deleted,
    };
  }
}
