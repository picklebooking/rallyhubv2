import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentUserResponse } from '@workspace/shared';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getCurrentUser(userId: string): Promise<CurrentUserResponse> {
    const user = await this.usersRepository.getById(userId);

    if (!user) {
      throw new NotFoundException('Authenticated user was not found');
    }

    return user;
  }
}
