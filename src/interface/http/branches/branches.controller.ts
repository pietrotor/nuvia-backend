import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AddBranchNotificationObserverDto } from '@application/appointment-notifications/dto/add-branch-notification-observer.dto';
import { AddBranchNotificationObserverUseCase } from '@application/appointment-notifications/use-cases/add-branch-notification-observer.use-case';
import { DisableNotificationSubscriptionUseCase } from '@application/appointment-notifications/use-cases/disable-notification-subscription.use-case';
import { ListBranchNotificationObserversUseCase } from '@application/appointment-notifications/use-cases/list-branch-notification-observers.use-case';
import { NotificationSettingsView } from '@application/appointment-notifications/dto/notification-subscription-view';
import { NotificationSubscriptionView } from '@application/appointment-notifications/dto/notification-subscription-view';
import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';
import { AssignProfessionalToBranchDto } from '@application/branches/dto/assign-professional-to-branch.dto';
import { CreateBranchDto } from '@application/branches/dto/create-branch.dto';
import { ListBranchesDto } from '@application/branches/dto/list-branches.dto';
import { OfferServiceAtBranchDto } from '@application/branches/dto/offer-service-at-branch.dto';
import { UpdateBranchDto } from '@application/branches/dto/update-branch.dto';
import { UpsertBranchProfessionalServiceWindowDto } from '@application/branches/dto/upsert-branch-professional-service-window.dto';
import { AssignProfessionalToBranchUseCase } from '@application/branches/use-cases/assign-professional-to-branch.use-case';
import { CreateBranchUseCase } from '@application/branches/use-cases/create-branch.use-case';
import { GetBranchUseCase } from '@application/branches/use-cases/get-branch.use-case';
import { ListBranchProfessionalServiceWindowsUseCase } from '@application/branches/use-cases/list-branch-professional-service-windows.use-case';
import { ListBranchProfessionalsUseCase } from '@application/branches/use-cases/list-branch-professionals.use-case';
import { ListBranchServicesUseCase } from '@application/branches/use-cases/list-branch-services.use-case';
import { ListBranchesUseCase } from '@application/branches/use-cases/list-branches.use-case';
import { OfferServiceAtBranchUseCase } from '@application/branches/use-cases/offer-service-at-branch.use-case';
import { RemoveBranchProfessionalServiceWindowUseCase } from '@application/branches/use-cases/remove-branch-professional-service-window.use-case';
import { UpdateBranchProfessionalUseCase } from '@application/branches/use-cases/update-branch-professional.use-case';
import { UpdateBranchServiceUseCase } from '@application/branches/use-cases/update-branch-service.use-case';
import { UpdateBranchUseCase } from '@application/branches/use-cases/update-branch.use-case';
import { UpsertBranchProfessionalServiceWindowUseCase } from '@application/branches/use-cases/upsert-branch-professional-service-window.use-case';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import {
  NotificationSettingsResponseDto,
  NotificationSubscriptionResponseDto,
} from '@interface/http/appointment-notifications/dto/notification-subscription-response.dto';

import { BranchProfessionalResponseDto } from './dto/branch-professional-response.dto';
import { BranchProfessionalServiceWindowResponseDto } from './dto/branch-professional-service-window-response.dto';
import { BranchResponseDto } from './dto/branch-response.dto';
import { BranchServiceResponseDto } from './dto/branch-service-response.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly createBranch: CreateBranchUseCase,
    private readonly listBranches: ListBranchesUseCase,
    private readonly getBranch: GetBranchUseCase,
    private readonly updateBranch: UpdateBranchUseCase,
    private readonly listBranchProfessionals: ListBranchProfessionalsUseCase,
    private readonly assignProfessional: AssignProfessionalToBranchUseCase,
    private readonly updateBranchProfessional: UpdateBranchProfessionalUseCase,
    private readonly listBranchServices: ListBranchServicesUseCase,
    private readonly offerService: OfferServiceAtBranchUseCase,
    private readonly updateBranchService: UpdateBranchServiceUseCase,
    private readonly listServiceWindows: ListBranchProfessionalServiceWindowsUseCase,
    private readonly upsertServiceWindow: UpsertBranchProfessionalServiceWindowUseCase,
    private readonly removeServiceWindow: RemoveBranchProfessionalServiceWindowUseCase,
    private readonly listBranchNotifications: ListBranchNotificationObserversUseCase,
    private readonly addBranchNotificationObserver: AddBranchNotificationObserverUseCase,
    private readonly disableNotificationSubscription: DisableNotificationSubscriptionUseCase,
    private readonly phoneNumbers: PhoneNumberService,
    private readonly tenantCountry: TenantCountryService,
  ) {}

  private async toNotificationSettings(
    view: NotificationSettingsView,
  ): Promise<NotificationSettingsResponseDto> {
    const countryCode = await this.tenantCountry.getCurrentCountryCode();
    return NotificationSettingsResponseDto.from(view, {
      countryCode,
      formatMasked: (phone) =>
        this.phoneNumbers.formatMaskedForDisplay(phone, countryCode),
    });
  }

  private async toNotificationSubscription(
    view: NotificationSubscriptionView,
  ): Promise<NotificationSubscriptionResponseDto> {
    const countryCode = await this.tenantCountry.getCurrentCountryCode();
    return NotificationSubscriptionResponseDto.from(view, {
      maskedPhone: this.phoneNumbers.formatMaskedForDisplay(
        view.contact.phoneE164,
        countryCode,
      ),
    });
  }

  @Get()
  @Auth(Permission.BRANCHES_READ)
  @ApiOperation({ summary: 'Lists the branches of the business' })
  @ApiResponse({ status: 200, type: [BranchResponseDto] })
  async list(@Query() query: ListBranchesDto): Promise<BranchResponseDto[]> {
    return (await this.listBranches.execute(query.activeOnly ?? false)).map(
      BranchResponseDto.from,
    );
  }

  @Get(':id')
  @Auth(Permission.BRANCHES_READ)
  @ApiOperation({ summary: 'Gets a branch by id' })
  @ApiResponse({ status: 200, type: BranchResponseDto })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.getBranch.execute(id));
  }

  @Post()
  @Auth(Permission.BRANCHES_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Creates a branch' })
  @ApiResponse({ status: 201, type: BranchResponseDto })
  async create(@Body() dto: CreateBranchDto): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.createBranch.execute(dto));
  }

  @Patch(':id')
  @Auth(Permission.BRANCHES_WRITE)
  @ApiOperation({ summary: 'Updates or deactivates a branch' })
  @ApiResponse({ status: 200, type: BranchResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    return BranchResponseDto.from(await this.updateBranch.execute(id, dto));
  }

  @Get(':id/professionals')
  @Auth(Permission.BRANCHES_READ)
  @ApiOperation({ summary: 'Lists professionals assigned to a branch' })
  @ApiResponse({ status: 200, type: [BranchProfessionalResponseDto] })
  async listProfessionals(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BranchProfessionalResponseDto[]> {
    return (await this.listBranchProfessionals.execute(id)).map(
      BranchProfessionalResponseDto.from,
    );
  }

  @Put(':id/professionals/:professionalId')
  @Auth(Permission.BRANCHES_WRITE)
  @ApiOperation({ summary: 'Assigns or updates a professional at a branch' })
  @ApiResponse({ status: 200, type: BranchProfessionalResponseDto })
  async upsertProfessional(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
    @Body() dto: AssignProfessionalToBranchDto,
  ): Promise<BranchProfessionalResponseDto> {
    return BranchProfessionalResponseDto.from(
      await this.assignProfessional.execute(id, professionalId, dto),
    );
  }

  @Delete(':id/professionals/:professionalId')
  @Auth(Permission.BRANCHES_WRITE)
  @ApiOperation({
    summary: 'Deactivates a professional assignment at a branch',
  })
  @ApiResponse({ status: 200, type: BranchProfessionalResponseDto })
  async unassignProfessional(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
  ): Promise<BranchProfessionalResponseDto> {
    return BranchProfessionalResponseDto.from(
      await this.updateBranchProfessional.execute(id, professionalId, {
        isActive: false,
      }),
    );
  }

  @Get(':id/services')
  @Auth(Permission.BRANCHES_READ)
  @ApiOperation({ summary: 'Lists services offered at a branch' })
  @ApiResponse({ status: 200, type: [BranchServiceResponseDto] })
  async listServices(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BranchServiceResponseDto[]> {
    return (await this.listBranchServices.execute(id)).map(
      BranchServiceResponseDto.from,
    );
  }

  @Put(':id/services/:serviceId')
  @Auth(Permission.BRANCHES_WRITE)
  @ApiOperation({ summary: 'Offers or updates a service at a branch' })
  @ApiResponse({ status: 200, type: BranchServiceResponseDto })
  async upsertService(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: OfferServiceAtBranchDto,
  ): Promise<BranchServiceResponseDto> {
    return BranchServiceResponseDto.from(
      await this.offerService.execute(id, serviceId, dto),
    );
  }

  @Delete(':id/services/:serviceId')
  @Auth(Permission.BRANCHES_WRITE)
  @ApiOperation({ summary: 'Deactivates a service offer at a branch' })
  @ApiResponse({ status: 200, type: BranchServiceResponseDto })
  async deactivateService(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<BranchServiceResponseDto> {
    return BranchServiceResponseDto.from(
      await this.updateBranchService.execute(id, serviceId, {
        isActive: false,
      }),
    );
  }

  @Get(':id/professionals/:professionalId/service-windows')
  @Auth(Permission.BRANCHES_READ)
  @ApiOperation({
    summary:
      'Lists optional service offer windows for a professional at a branch',
  })
  @ApiResponse({
    status: 200,
    type: [BranchProfessionalServiceWindowResponseDto],
  })
  async listProfessionalServiceWindows(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
  ): Promise<BranchProfessionalServiceWindowResponseDto[]> {
    return (await this.listServiceWindows.execute(id, professionalId)).map(
      BranchProfessionalServiceWindowResponseDto.from,
    );
  }

  @Put(':id/professionals/:professionalId/service-windows/:serviceId')
  @Auth(Permission.BRANCHES_WRITE)
  @ApiOperation({
    summary: 'Sets or updates when a professional offers a service at a branch',
  })
  @ApiResponse({
    status: 200,
    type: BranchProfessionalServiceWindowResponseDto,
  })
  async upsertProfessionalServiceWindow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: UpsertBranchProfessionalServiceWindowDto,
  ): Promise<BranchProfessionalServiceWindowResponseDto> {
    return BranchProfessionalServiceWindowResponseDto.from(
      await this.upsertServiceWindow.execute(
        id,
        professionalId,
        serviceId,
        dto,
      ),
    );
  }

  @Delete(':id/professionals/:professionalId/service-windows/:serviceId')
  @Auth(Permission.BRANCHES_WRITE)
  @ApiOperation({
    summary:
      'Removes the custom service offer window (falls back to full schedule)',
  })
  @ApiResponse({
    status: 200,
    type: BranchProfessionalServiceWindowResponseDto,
  })
  async removeProfessionalServiceWindow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('professionalId', ParseUUIDPipe) professionalId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ): Promise<BranchProfessionalServiceWindowResponseDto> {
    return BranchProfessionalServiceWindowResponseDto.from(
      await this.removeServiceWindow.execute(id, professionalId, serviceId),
    );
  }

  @Get(':id/notifications')
  @Auth(Permission.APPOINTMENT_NOTIFICATIONS_READ)
  @ApiOperation({
    summary:
      'Lists observer contacts for appointment notifications at a branch',
  })
  @ApiResponse({ status: 200, type: NotificationSettingsResponseDto })
  async listNotifications(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NotificationSettingsResponseDto> {
    return this.toNotificationSettings(
      await this.listBranchNotifications.execute(id),
    );
  }

  @Post(':id/notifications')
  @Auth(Permission.APPOINTMENT_NOTIFICATIONS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Adds an observer WhatsApp contact for a branch',
  })
  @ApiResponse({ status: 201, type: NotificationSubscriptionResponseDto })
  async addObserver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddBranchNotificationObserverDto,
  ): Promise<NotificationSubscriptionResponseDto> {
    return this.toNotificationSubscription(
      await this.addBranchNotificationObserver.execute(id, dto),
    );
  }

  @Delete(':id/notifications/:subscriptionId')
  @Auth(Permission.APPOINTMENT_NOTIFICATIONS_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Disables a branch observer notification subscription',
  })
  @ApiResponse({ status: 204 })
  async disableObserver(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string,
  ): Promise<void> {
    await this.disableNotificationSubscription.execute({
      subscriptionId,
      branchId: id,
    });
  }
}
