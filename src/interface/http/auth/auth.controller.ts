import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { LoginDto } from '@application/auth/dto/login.dto';
import { LoginUseCase } from '@application/auth/use-cases/login.use-case';
import { User } from '@domain/users/entities/user.entity';
import { Role } from '@domain/users/value-objects/role.vo';
import { Auth, GetUser } from '../common/decorators';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión y devuelve el token del tenant' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
  ): Promise<LoginResponseDto> {
    return LoginResponseDto.from(await this.loginUseCase.execute(dto, ip));
  }

  @Get('me')
  @Auth(Role.OWNER, Role.STAFF, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Devuelve el usuario autenticado' })
  me(@GetUser() user: User): UserResponseDto {
    return UserResponseDto.from(user.toPublic());
  }
}
