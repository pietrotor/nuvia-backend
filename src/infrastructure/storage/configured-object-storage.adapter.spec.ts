import { ConfigService } from '@nestjs/config';

import { InternalError } from '@domain/common/exceptions';

import { ConfiguredObjectStorageAdapter } from './configured-object-storage.adapter';
import { LocalObjectStorageAdapter } from './local-object-storage.adapter';
import { S3ObjectStorageAdapter } from './s3-object-storage.adapter';

describe('ConfiguredObjectStorageAdapter', () => {
  const adapterFor = (driver?: string) => {
    const config = {
      get: jest.fn((_key: string, fallback?: string) => driver ?? fallback),
    };
    const local = {
      get: jest
        .fn()
        .mockResolvedValue({ body: Buffer.from('local'), contentType: null }),
    };
    const s3 = {
      get: jest.fn().mockResolvedValue({
        body: Buffer.from('s3'),
        contentType: 'image/png',
      }),
    };

    return {
      local,
      s3,
      adapter: new ConfiguredObjectStorageAdapter(
        config as unknown as ConfigService,
        local as unknown as LocalObjectStorageAdapter,
        s3 as unknown as S3ObjectStorageAdapter,
      ),
    };
  };

  it('uses the filesystem when no driver is configured', async () => {
    const { adapter, local, s3 } = adapterFor();

    await adapter.get('k');

    expect(local.get).toHaveBeenCalledWith('k');
    expect(s3.get).not.toHaveBeenCalled();
  });

  it('uses S3 when the deployment asks for it', async () => {
    const { adapter, local, s3 } = adapterFor('s3');

    await adapter.get('k');

    expect(s3.get).toHaveBeenCalledWith('k');
    expect(local.get).not.toHaveBeenCalled();
  });

  it('refuses to guess a backend for an unknown driver', async () => {
    const { adapter } = adapterFor('dropbox');

    await expect(adapter.get('k')).rejects.toBeInstanceOf(InternalError);
  });
});
