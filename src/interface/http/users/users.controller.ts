import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateUserDto } from '@application/users/dto/create-user.dto';
import { UpdateUserRoleDto } from '@application/users/dto/update-user-role.dto';
import { CreateUserUseCase } from '@application/users/use-cases/create-user.use-case';
import { ListUsersUseCase } from '@application/users/use-cases/list-users.use-case';
import { UpdateUserRoleUseCase } from '@application/users/use-cases/update-user-role.use-case';
import { UpdateUserContactUseCase } from '@application/users/use-cases/update-user-contact.use-case';
import { DeactivateUserUseCase } from '@application/users/use-cases/deactivate-user.use-case';
import { UpdateUserContactDto } from '@application/users/dto/update-user-contact.dto';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '../common/decorators';
import { UserResponseDto } from './dto/user-response.dto';

// Every route here reads and writes only inside the tenant of the token: the
// repository takes it from the request context, there is no tenant in the path.
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly updateUserRole: UpdateUserRoleUseCase,
    private readonly updateUserContact: UpdateUserContactUseCase,
    private readonly deactivateUser: DeactivateUserUseCase,
  ) {}

  @Post()
  @Auth(Permission.USERS_WRITE)
  @ApiOperation({ summary: 'Creates a user in the business of the token' })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.createUser.execute(dto));
  }

  @Get()
  @Auth(Permission.USERS_READ)
  @ApiOperation({ summary: 'Lists the users of the business of the token' })
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.listUsers.execute();

    return users.map(UserResponseDto.from);
  }

  @Patch(':id/role')
  @Auth(Permission.USERS_WRITE)
  @ApiOperation({ summary: 'Changes the role of a user of the business' })
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.updateUserRole.execute(id, dto));
  }

  @Patch(':id/contact')
  @Auth(Permission.USERS_WRITE)
  @ApiOperation({
    summary: 'Updates the contact phone of a user of the business',
  })
  async updateContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserContactDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.updateUserContact.execute(id, dto));
  }

  @Delete(':id')
  @Auth(Permission.USERS_WRITE)
  @ApiOperation({ summary: 'Deactivates a user (the record is not deleted)' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.deactivateUser.execute(id));
  }
}
