import { Inject, Injectable } from '@nestjs/common';

import {
  USER_REPOSITORY,
  UserRepository,
} from '@domain/users/repositories/user.repository';
import { PublicUser } from '@domain/users/entities/user.entity';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(): Promise<PublicUser[]> {
    const users = await this.userRepository.findAllOfTenant();

    return users.map((user) => user.toPublic());
  }
}
