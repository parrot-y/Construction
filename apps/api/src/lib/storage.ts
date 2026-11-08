import fs from 'node:fs';
import path from 'node:path';

/**
 * Storage driver seam (audit H-02): uploads default to a local volume
 * (UPLOAD_DIR — mount a persistent volume or shared filesystem in deploy).
 * Set UPLOAD_DRIVER=s3 plus the standard AWS_* env vars to move bytes to
 * object storage; the S3 driver is intentionally not bundled until keys exist.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

export function getStorageDriver(): StorageDriver {
  const driver = process.env.UPLOAD_DRIVER || 'local';
  if (driver !== 'local') {
    throw new Error(`UPLOAD_DRIVER=${driver} is not configured. Use 'local' (UPLOAD_DIR volume) until object-storage credentials are provisioned.`);
  }
  return localDriver;
}

const uploadRoot = () => process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');

const localDriver: StorageDriver = {
  async put(key, data) {
    const dest = path.join(uploadRoot(), key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
  },
  async get(key) {
    const src = path.join(uploadRoot(), key);
    if (!fs.existsSync(src)) return null;
    return fs.promises.readFile(src);
  },
};
