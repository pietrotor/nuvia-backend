import { Controller, Get, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { CurrentTenant } from '@interface/http/common/decorators/current-tenant.decorator';
import { SseConnectionRegistry } from '@infrastructure/realtime/sse-connection.registry';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly registry: SseConnectionRegistry) {}

  /**
   * Single stream for the whole panel, with the kind of change in each frame. One stream per feature
   * would spend the browser budget of six connections per origin under HTTP/1.1, counted across tabs.
   *
   * Uses the raw response instead of Nest's `@Sse()` because that wraps an `Observable` and hides the
   * return value of `write`, which is exactly what backpressure needs. The mechanics live in the
   * registry, so nothing of that leaks past this line.
   */
  @Get()
  @Auth(Permission.EVENTS_READ)
  @ApiOperation({
    summary: 'Stream of changes for the panel (SSE)',
    description:
      'Long-lived `text/event-stream`. Each frame announces that something changed so the client can refetch; it never carries entities. Scoped to the tenant of the token.',
  })
  @ApiResponse({ status: 200, description: 'Event stream opened' })
  stream(
    @CurrentTenant() tenantId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): void {
    this.registry.open(tenantId, request, response);
  }
}
