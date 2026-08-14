import { Module } from '@nestjs/common';

import { CreateClientUseCase } from '@application/clients/use-cases/create-client.use-case';
import { GetClientUseCase } from '@application/clients/use-cases/get-client.use-case';
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
  ],
})
export class ClientsModule {}
