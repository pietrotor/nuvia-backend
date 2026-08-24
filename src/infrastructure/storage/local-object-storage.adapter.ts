import { createHash } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ErrorCode, NotFoundError } from '@domain/common/exceptions';
import {
  ObjectStoragePort,
  StoreObjectInput,
  StoredObject,
  StoredObjectBody,
} from '@domain/storage/ports/object-storage.port';

@Injectable()
export class LocalObjectStorageAdapter implements ObjectStoragePort {
  private readonly root: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.root = config.get<string>('STORAGE_LOCAL_PATH', './storage');
  }

  async store(input: StoreObjectInput): Promise<StoredObject> {
    const fullPath = join(this.root, input.key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.body);
    return { key: input.key, url: `file://${fullPath}` };
  }

  async get(key: string): Promise<StoredObjectBody> {
    try {
      const body = await readFile(join(this.root, key));
      // The filesystem does not keep the content type: it lives in the row that
      // owns the key.
      return { body, contentType: null };
    } catch {
      throw new NotFoundError(ErrorCode.STORAGE_OBJECT_NOT_FOUND, { key });
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    const fullPath = join(this.root, key);
    // Local stub: deterministic pseudo-signed path for tests
    const token = createHash('sha256').update(key).digest('hex').slice(0, 16);
    return `file://${fullPath}?t=${token}`;
  }

  async delete(key: string): Promise<void> {
    await unlink(join(this.root, key)).catch(() => undefined);
  }
}
