import fs from 'node:fs';
import path from 'node:path';

/**
 * Storage driver seam (audit H-02 + staging hardening).
 *
 * UPLOAD_DRIVER:
 *   local (default, dev/e2e) — UPLOAD_DIR volume.
 *   s3 — S3_BUCKET + AWS_REGION (+ optional S3_ENDPOINT for localstack,
 *        S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY for non-IAM environments).
 *        Objects are private with SSE-S3 (AES256); downloads stay proxied
 *        through /uploads/* so tenant + membership + magic-byte checks all
 *        still apply — S3 is never exposed directly.
 */
export interface StorageDriver {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

export function getStorageDriver(): StorageDriver {
  const driver = process.env.UPLOAD_DRIVER || 'local';
  if (driver === 'local') return localDriver;
  if (driver === 's3') return s3Driver;
  throw new Error(`Unknown UPLOAD_DRIVER=${driver}. Use 'local' or 's3'.`);
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

// ---------------------------------------------------------------- S3

let s3ClientPromise: Promise<any> | null = null;

async function s3Client() {
  if (!s3ClientPromise) {
    s3ClientPromise = (async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const endpoint = process.env.S3_ENDPOINT || undefined;
      return new S3Client({
        region: process.env.S3_REGION || process.env.AWS_REGION || 'af-south-1',
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        ...(process.env.S3_ACCESS_KEY_ID
          ? {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
              },
            }
          : {}),
      });
    })();
  }
  return s3ClientPromise;
}

const s3Bucket = () => {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('UPLOAD_DRIVER=s3 requires S3_BUCKET');
  return bucket;
};

const s3Driver: StorageDriver = {
  async put(key, data) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await s3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: s3Bucket(),
        Key: key,
        Body: data,
        // Private bucket + SSE-S3 encryption at rest (staging requirement).
        ServerSideEncryption: 'AES256',
      }),
    );
  },
  async get(key) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await s3Client();
    try {
      const out = await client.send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key }));
      const bytes = await out.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  },
};
