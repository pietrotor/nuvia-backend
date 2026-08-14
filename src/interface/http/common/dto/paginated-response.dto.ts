import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  static of<T>(
    data: T[],
    total: number,
    limit: number,
    offset: number,
  ): PaginatedResponseDto<T> {
    return { data, total, limit, offset };
  }
}
