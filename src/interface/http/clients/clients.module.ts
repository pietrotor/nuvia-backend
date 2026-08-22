import { Module } from '@nestjs/common';

import { ConfirmClientNameUseCase } from '@application/clients/use-cases/confirm-client-name.use-case';
import { CreateClientUseCase } from '@application/clients/use-cases/create-client.use-case';
import { GetClientUseCase } from '@application/clients/use-cases/get-client.use-case';
import { ListBookingAttendeesUseCase } from '@application/clients/use-cases/list-booking-attendees.use-case';
import { ResolveBookingAttendeeUseCase } from '@application/clients/use-cases/resolve-booking-attendee.use-case';
import { SearchClientsUseCase } from '@application/clients/use-cases/search-clients.use-case';
import { UpdateClientUseCase } from '@application/clients/use-cases/update-client.use-case';
import { AppointmentsModule } from '@interface/http/appointments/appointments.module';
import { ClientsController } from './clients.controller';

@Module({
  imports: [AppointmentsModule],
  controllers: [ClientsController],
  providers: [
    SearchClientsUseCase,
    GetClientUseCase,
    CreateClientUseCase,
    UpdateClientUseCase,
    ConfirmClientNameUseCase,
    ListBookingAttendeesUseCase,
    ResolveBookingAttendeeUseCase,
  ],
  exports: [
    ConfirmClientNameUseCase,
    ListBookingAttendeesUseCase,
    ResolveBookingAttendeeUseCase,
  ],
})
export class ClientsModule {}
