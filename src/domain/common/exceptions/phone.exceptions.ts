import { ErrorCode, ValidationError } from '@domain/common/exceptions';

export class InvalidPhoneNumberError extends ValidationError {
  constructor() {
    super(ErrorCode.INVALID_PHONE_NUMBER);
  }
}

export class PhoneExtensionNotSupportedError extends ValidationError {
  constructor() {
    super(ErrorCode.PHONE_EXTENSION_NOT_SUPPORTED);
  }
}

export class UnsupportedCountryCodeError extends ValidationError {
  constructor() {
    super(ErrorCode.UNSUPPORTED_COUNTRY_CODE);
  }
}
