import { Global, Module } from '@nestjs/common';

import { PhoneNumberService } from './services/phone-number.service';
import { TenantCountryService } from './services/tenant-country.service';

@Global()
@Module({
  providers: [PhoneNumberService, TenantCountryService],
  exports: [PhoneNumberService, TenantCountryService],
})
export class ApplicationCommonModule {}
