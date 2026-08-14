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
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth, GetUser } from '../common/decorators';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logs in and returns the tenant token' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
  ): Promise<LoginResponseDto> {
    return LoginResponseDto.from(await this.loginUseCase.execute(dto, ip));
  }

  @Get('me')
  @Auth(Permission.TENANT_READ, Permission.TENANTS_ADMIN)
  @ApiOperation({ summary: 'Returns the authenticated user' })
  me(@GetUser() user: User): UserResponseDto {
    return UserResponseDto.from(user.toPublic());
  }
}
