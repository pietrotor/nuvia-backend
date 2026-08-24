import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DomainException,
  ErrorCode,
  InternalError,
  NotFoundError,
} from '@domain/common/exceptions';
import {
  ObjectStoragePort,
  StoreObjectInput,
  StoredObject,
  StoredObjectBody,
} from '@domain/storage/ports/object-storage.port';

// Long enough for WhatsApp to fetch the image, short enough that a leaked URL is
// worthless. Not configurable: no deployment has a reason to want a different one.
const SIGNED_URL_TTL_SECONDS = 900;

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStoragePort {
  // One client for the whole process: it pools connections and resolves credentials
  // once, so building it per request would pay that cost on every upload.
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  async store(input: StoreObjectInput): Promise<StoredObject> {
    await this.run(() =>
      this.s3().send(
        new PutObjectCommand({
          Bucket: this.bucket(),
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      ),
    );

    // The caller stores the key, not this URL: persisting a provider URL would turn
    // a change of storage provider into a data migration.
    return { key: input.key, url: await this.getSignedUrl(input.key) };
  }

  async get(key: string): Promise<StoredObjectBody> {
    const response = await this.run(
      () =>
        this.s3().send(
          new GetObjectCommand({ Bucket: this.bucket(), Key: key }),
        ),
      key,
    );

    if (!response.Body) {
      throw new NotFoundError(ErrorCode.STORAGE_OBJECT_NOT_FOUND, { key });
    }

    const body = Buffer.from(await response.Body.transformToByteArray());
    return { body, contentType: response.ContentType ?? null };
  }

  async getSignedUrl(key: string): Promise<string> {
    return this.run(() =>
      getSignedUrl(
        this.s3(),
        new GetObjectCommand({ Bucket: this.bucket(), Key: key }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      ),
    );
  }

  async delete(key: string): Promise<void> {
    await this.run(() =>
      this.s3().send(
        new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }),
      ),
    );
  }

  // Anything the SDK throws is infrastructure detail. A missing object is the one
  // case the caller can act on, and only when it knows which key it asked for.
  private async run<T>(operation: () => Promise<T>, key?: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DomainException) throw error;
      if (key !== undefined && this.isMissingObject(error)) {
        throw new NotFoundError(ErrorCode.STORAGE_OBJECT_NOT_FOUND, { key });
      }
      throw new InternalError(ErrorCode.STORAGE_NOT_CONFIGURED, {
        reason: this.nameOf(error),
      });
    }
  }

  private s3(): S3Client {
    if (this.client) return this.client;

    const region = this.config.get<string>('AWS_REGION');
    if (!region) throw new InternalError(ErrorCode.STORAGE_NOT_CONFIGURED);

    // Credentials come from the SDK default chain: keys in the environment for
    // development, an IAM role in production. They are never read here, so they
    // cannot end up in a log line.
    this.client = new S3Client({ region });

    return this.client;
  }

  private bucket(): string {
    const bucket = this.config.get<string>('AWS_S3_BUCKET');
    if (!bucket) throw new InternalError(ErrorCode.STORAGE_NOT_CONFIGURED);

    return bucket;
  }

  private isMissingObject(error: unknown): boolean {
    const name = this.nameOf(error);
    return name === 'NoSuchKey' || name === 'NotFound';
  }

  private nameOf(error: unknown): string {
    return (error as { name?: string })?.name ?? 'unknown';
  }
}
