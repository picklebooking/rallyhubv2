import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTenantMemberDto } from './update-tenant-member.dto';

describe('tenant-member-dtos', () => {
  it('strips email from membership updates', async () => {
    const dto = plainToInstance(UpdateTenantMemberDto, {
      email: 'x@y.z',
      role: 'STAFF',
    });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto).not.toHaveProperty('email');
    expect(dto.role).toBe('STAFF');
  });
});
