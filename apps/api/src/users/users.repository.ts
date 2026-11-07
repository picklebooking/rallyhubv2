import { Injectable } from '@nestjs/common';
import type { CurrentUserResponse } from '@workspace/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<CurrentUserResponse | null> {
    const user = await this.prisma.db.user.findUnique({ where: { id } });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.image,
    };
  }
}
