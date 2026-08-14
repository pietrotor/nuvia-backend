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

import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { BookAppointmentUseCase } from '@application/appointments/use-cases/book-appointment.use-case';
import { CancelAppointmentUseCase } from '@application/appointments/use-cases/cancel-appointment.use-case';
import { GetAppointmentUseCase } from '@application/appointments/use-cases/get-appointment.use-case';
import { GetAvailabilityUseCase } from '@application/appointments/use-cases/get-availability.use-case';
import { ListAppointmentsUseCase } from '@application/appointments/use-cases/list-appointments.use-case';
import { MarkAppointmentAttendedUseCase } from '@application/appointments/use-cases/mark-appointment-attended.use-case';
import { MarkAppointmentNoShowUseCase } from '@application/appointments/use-cases/mark-appointment-no-show.use-case';
import { RescheduleAppointmentUseCase } from '@application/appointments/use-cases/reschedule-appointment.use-case';
import { BookAppointmentDto } from '@application/appointments/dto/book-appointment.dto';
import { CancelAppointmentDto } from '@application/appointments/dto/cancel-appointment.dto';
import { GetAvailabilityDto } from '@application/appointments/dto/get-availability.dto';
import { ListAppointmentsDto } from '@application/appointments/dto/list-appointments.dto';
import { RescheduleAppointmentDto } from '@application/appointments/dto/reschedule-appointment.dto';
import { AppointmentChangeResponseDto } from './dto/appointment-change-response.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { AppointmentViewResponseDto } from './dto/appointment-view-response.dto';
import { AvailabilitySlotResponseDto } from './dto/availability-slot-response.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly bookAppointment: BookAppointmentUseCase,
    private readonly getAvailability: GetAvailabilityUseCase,
    private readonly getAppointment: GetAppointmentUseCase,
    private readonly listAppointments: ListAppointmentsUseCase,
    private readonly rescheduleAppointment: RescheduleAppointmentUseCase,
    private readonly cancelAppointment: CancelAppointmentUseCase,
    private readonly markAttended: MarkAppointmentAttendedUseCase,
    private readonly markNoShow: MarkAppointmentNoShowUseCase,
  ) {}

  @Get('availability')
  @Auth(Permission.APPOINTMENTS_READ)
  @ApiOperation({ summary: 'Lists available slots' })
  @ApiResponse({ status: 200, type: [AvailabilitySlotResponseDto] })
  async availability(
    @Query() query: GetAvailabilityDto,
  ): Promise<AvailabilitySlotResponseDto[]> {
    const slots = await this.getAvailability.execute(query, BookingActor.STAFF);
    return slots.map(AvailabilitySlotResponseDto.from);
  }

  @Get()
  @Auth(Permission.APPOINTMENTS_READ)
  @ApiOperation({
    summary:
      'Lists appointments by date range, with client, professional and service',
    description:
      'The range is inclusive and uses the business timezone. With no dates, it returns the appointments for today.',
  })
  @ApiResponse({ status: 200, type: [AppointmentViewResponseDto] })
  async list(
    @Query() query: ListAppointmentsDto,
  ): Promise<AppointmentViewResponseDto[]> {
    const appointments = await this.listAppointments.execute(query);
    return appointments.map(AppointmentViewResponseDto.from);
  }

  // Declared after the literal routes so 'availability' is never read as an id.
  @Get(':id')
  @Auth(Permission.APPOINTMENTS_READ)
  @ApiOperation({
    summary: 'Gets one appointment with its client, professional and service',
  })
  @ApiResponse({ status: 200, type: AppointmentViewResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentViewResponseDto> {
    return AppointmentViewResponseDto.from(
      await this.getAppointment.execute(id),
    );
  }

  @Post()
  @Auth(Permission.APPOINTMENTS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Books an appointment' })
  @ApiResponse({ status: 201, type: AppointmentResponseDto })
  async book(@Body() dto: BookAppointmentDto): Promise<AppointmentResponseDto> {
    const appointment = await this.bookAppointment.execute(
      dto,
      BookingActor.STAFF,
    );
    return AppointmentResponseDto.from(appointment);
  }

  @Patch(':id/reschedule')
  @Auth(Permission.APPOINTMENTS_WRITE)
  @ApiOperation({
    summary: 'Reschedules an appointment to a new available slot',
  })
  @ApiResponse({ status: 200, type: AppointmentChangeResponseDto })
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ): Promise<AppointmentChangeResponseDto> {
    return AppointmentChangeResponseDto.from(
      await this.rescheduleAppointment.execute(id, dto, {
        actor: BookingActor.STAFF,
      }),
    );
  }

  @Post(':id/cancel')
  @Auth(Permission.APPOINTMENTS_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancels an appointment without deleting it' })
  @ApiResponse({ status: 200, type: AppointmentChangeResponseDto })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
  ): Promise<AppointmentChangeResponseDto> {
    return AppointmentChangeResponseDto.from(
      await this.cancelAppointment.execute(id, dto),
    );
  }

  @Post(':id/attend')
  @Auth(Permission.APPOINTMENTS_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marks the appointment as attended' })
  @ApiResponse({ status: 200, type: AppointmentResponseDto })
  async attend(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentResponseDto> {
    return AppointmentResponseDto.from(await this.markAttended.execute(id));
  }

  @Post(':id/no-show')
  @Auth(Permission.APPOINTMENTS_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marks the appointment as a no-show' })
  @ApiResponse({ status: 200, type: AppointmentResponseDto })
  async noShow(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentResponseDto> {
    return AppointmentResponseDto.from(await this.markNoShow.execute(id));
  }
}
