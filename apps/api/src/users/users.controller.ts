import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { CurrentUserResponse } from '@workspace/shared';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getCurrentUser(
    @Session() session: UserSession,
  ): Promise<CurrentUserResponse> {
    return this.usersService.getCurrentUser(session.user.id);
  }
}
