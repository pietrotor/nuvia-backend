import { ApiProperty } from '@nestjs/swagger';

import { LoginResult } from '@application/auth/use-cases/login.use-case';
import { UserResponseDto } from '@interface/http/users/dto/user-response.dto';

export class LoginResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  static from(result: LoginResult): LoginResponseDto {
    return {
      token: result.token,
      user: UserResponseDto.from(result.user),
    };
  }
}
