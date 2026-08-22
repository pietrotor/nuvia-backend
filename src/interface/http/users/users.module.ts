import { Module } from '@nestjs/common';

import { CreateUserUseCase } from '@application/users/use-cases/create-user.use-case';
import { ListUsersUseCase } from '@application/users/use-cases/list-users.use-case';
import { UpdateUserRoleUseCase } from '@application/users/use-cases/update-user-role.use-case';
import { UpdateUserContactUseCase } from '@application/users/use-cases/update-user-contact.use-case';
import { DeactivateUserUseCase } from '@application/users/use-cases/deactivate-user.use-case';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    CreateUserUseCase,
    ListUsersUseCase,
    UpdateUserRoleUseCase,
    UpdateUserContactUseCase,
    DeactivateUserUseCase,
  ],
})
export class UsersModule {}
