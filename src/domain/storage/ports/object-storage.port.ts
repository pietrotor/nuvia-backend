export interface StoreObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredObject {
  key: string;
  url: string;
}

export interface StoredObjectBody {
  body: Buffer;
  // Null when the backend does not keep the type alongside the bytes; the caller
  // falls back to what it recorded when storing.
  contentType: string | null;
}

export interface ObjectStoragePort {
  store(input: StoreObjectInput): Promise<StoredObject>;
  get(key: string): Promise<StoredObjectBody>;
  getSignedUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export const OBJECT_STORAGE_PORT = 'ObjectStoragePort';
