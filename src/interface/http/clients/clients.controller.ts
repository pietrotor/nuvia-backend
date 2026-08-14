import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateClientDto } from '@application/clients/dto/create-client.dto';
import { SearchClientsDto } from '@application/clients/dto/search-clients.dto';
import { UpdateClientDto } from '@application/clients/dto/update-client.dto';
import { CreateClientUseCase } from '@application/clients/use-cases/create-client.use-case';
import { GetClientUseCase } from '@application/clients/use-cases/get-client.use-case';
import { SearchClientsUseCase } from '@application/clients/use-cases/search-clients.use-case';
import { UpdateClientUseCase } from '@application/clients/use-cases/update-client.use-case';
import { ListEntityAppointmentsQueryDto } from '@application/appointments/dto/list-entity-appointments-query.dto';
import { ListClientAppointmentsUseCase } from '@application/appointments/use-cases/list-client-appointments.use-case';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { ClientSummaryResponseDto } from '@interface/http/common/dto/client-summary-response.dto';
import { PaginatedResponseDto } from '@interface/http/common/dto/paginated-response.dto';
import { AppointmentViewResponseDto } from '@interface/http/appointments/dto/appointment-view-response.dto';
import { ClientResponseDto } from './dto/client-response.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly searchClients: SearchClientsUseCase,
    private readonly getClient: GetClientUseCase,
    private readonly createClient: CreateClientUseCase,
    private readonly updateClient: UpdateClientUseCase,
    private readonly listClientAppointments: ListClientAppointmentsUseCase,
  ) {}

  @Get()
  @Auth(Permission.CLIENTS_READ)
  @ApiOperation({ summary: 'Searches clients by name or phone' })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  async search(
    @Query() dto: SearchClientsDto,
  ): Promise<PaginatedResponseDto<ClientSummaryResponseDto>> {
    const result = await this.searchClients.execute(dto);
    return PaginatedResponseDto.of(
      result.rows.map(ClientSummaryResponseDto.from),
      result.total,
      result.limit,
      result.offset,
    );
  }

  @Get(':id/appointments')
  @Auth(Permission.CLIENTS_READ)
  @ApiOperation({
    summary: 'Lists the appointments of a client',
    description:
      'Full history by default. Pass onlyUpcoming=true for pending and confirmed from now on.',
  })
  @ApiResponse({ status: 200, type: [AppointmentViewResponseDto] })
  async listAppointments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListEntityAppointmentsQueryDto,
  ): Promise<AppointmentViewResponseDto[]> {
    await this.getClient.execute(id);
    const views = await this.listClientAppointments.execute({
      clientId: id,
      onlyUpcoming: query.onlyUpcoming,
    });
    return views.map(AppointmentViewResponseDto.from);
  }

  @Get(':id')
  @Auth(Permission.CLIENTS_READ)
  @ApiOperation({ summary: 'Gets a client by id' })
  @ApiResponse({ status: 200, type: ClientResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientResponseDto> {
    return ClientResponseDto.from(await this.getClient.execute(id));
  }

  @Post()
  @Auth(Permission.CLIENTS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Creates a client',
    description:
      'A phone already registered returns the existing client instead of failing.',
  })
  @ApiResponse({ status: 201, type: ClientSummaryResponseDto })
  async create(
    @Body() dto: CreateClientDto,
  ): Promise<ClientSummaryResponseDto> {
    return ClientSummaryResponseDto.from(await this.createClient.execute(dto));
  }

  @Patch(':id')
  @Auth(Permission.CLIENTS_WRITE)
  @ApiOperation({ summary: 'Updates a client' })
  @ApiResponse({ status: 200, type: ClientResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    return ClientResponseDto.from(await this.updateClient.execute(id, dto));
  }
}
