import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ErrorCode, InternalError } from '@domain/common/exceptions';
import {
  ObjectStoragePort,
  StoreObjectInput,
  StoredObject,
  StoredObjectBody,
} from '@domain/storage/ports/object-storage.port';

import { LocalObjectStorageAdapter } from './local-object-storage.adapter';
import { S3ObjectStorageAdapter } from './s3-object-storage.adapter';

// Which storage backend runs is deployment configuration, not a domain concern:
// `s3` in production, `local` for tests and for working without network.
@Injectable()
export class ConfiguredObjectStorageAdapter implements ObjectStoragePort {
  constructor(
    private readonly config: ConfigService,
    private readonly local: LocalObjectStorageAdapter,
    private readonly s3: S3ObjectStorageAdapter,
  ) {}

  // Async so that a misconfigured driver rejects the promise instead of throwing
  // synchronously at the call site.
  async store(input: StoreObjectInput): Promise<StoredObject> {
    return this.driver().store(input);
  }

  async get(key: string): Promise<StoredObjectBody> {
    return this.driver().get(key);
  }

  async getSignedUrl(key: string): Promise<string> {
    return this.driver().getSignedUrl(key);
  }

  async delete(key: string): Promise<void> {
    return this.driver().delete(key);
  }

  private driver(): ObjectStoragePort {
    const driver = this.config.get<string>('STORAGE_DRIVER', 'local');
    switch (driver) {
      case 's3':
        return this.s3;
      case 'local':
        return this.local;
      default:
        throw new InternalError(ErrorCode.STORAGE_NOT_CONFIGURED, { driver });
    }
  }
}
