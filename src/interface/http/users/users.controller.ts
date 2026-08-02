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
import { DeactivateUserUseCase } from '@application/users/use-cases/deactivate-user.use-case';
import { Role } from '@domain/users/value-objects/role.vo';
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
    private readonly deactivateUser: DeactivateUserUseCase,
  ) {}

  @Post()
  @Auth(Role.OWNER)
  @ApiOperation({ summary: 'Crea un usuario en el negocio del token' })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.createUser.execute(dto));
  }

  @Get()
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Lista los usuarios del negocio del token' })
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.listUsers.execute();

    return users.map(UserResponseDto.from);
  }

  @Patch(':id/role')
  @Auth(Role.OWNER)
  @ApiOperation({ summary: 'Cambia el rol de un usuario del negocio' })
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.updateUserRole.execute(id, dto));
  }

  @Delete(':id')
  @Auth(Role.OWNER)
  @ApiOperation({ summary: 'Desactiva un usuario (no se borra el registro)' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.deactivateUser.execute(id));
  }
}
