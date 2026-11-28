import path from 'node:path';

/**
 * Upload security (audit H-02):
 *  - Extension is derived from the VERIFIED mime type, never the filename.
 *  - Magic-byte signatures are checked against the declared mime type.
 *  - Serving is authenticated + tenant-scoped (see routes/files.ts).
 */

export interface AllowedUpload {
  ext: string;
  contentType: string;
  /** Returns true when the leading bytes match this format's signature. */
  magic: (b: Buffer) => boolean;
}

const startsWith = (b: Buffer, sig: number[]) => sig.every((byte, i) => b[i] === byte);
const ascii = (b: Buffer, s: string, offset = 0) => b.subarray(offset, offset + s.length).toString('latin1') === s;

export const ALLOWED_UPLOADS: Record<string, AllowedUpload> = {
  'image/jpeg': {
    ext: '.jpg', contentType: 'image/jpeg',
    magic: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  },
  'image/png': {
    ext: '.png', contentType: 'image/png',
    magic: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  'image/webp': {
    ext: '.webp', contentType: 'image/webp',
    magic: (b) => ascii(b, 'RIFF') && ascii(b, 'WEBP', 8),
  },
  'image/gif': {
    ext: '.gif', contentType: 'image/gif',
    magic: (b) => ascii(b, 'GIF87a') || ascii(b, 'GIF89a'),
  },
  'image/heic': {
    ext: '.heic', contentType: 'image/heic',
    magic: (b) => ascii(b, 'ftyp', 4) && ['heic', 'heix', 'mif1', 'msf1'].includes(b.subarray(8, 12).toString('latin1')),
  },
  'application/pdf': {
    ext: '.pdf', contentType: 'application/pdf',
    magic: (b) => ascii(b, '%PDF-'),
  },
  'video/mp4': {
    ext: '.mp4', contentType: 'video/mp4',
    magic: (b) => ascii(b, 'ftyp', 4),
  },
  'video/quicktime': {
    ext: '.mov', contentType: 'video/quicktime',
    magic: (b) => ascii(b, 'ftyp', 4),
  },
};

export const ALLOWED_MIME_PATTERN = new RegExp(
  `^(${Object.keys(ALLOWED_UPLOADS).map((m) => m.replace('/', '\\/')).join('|')})$`,
);

export function verifyUpload(buffer: Buffer, mimetype: string): AllowedUpload | null {
  const spec = ALLOWED_UPLOADS[mimetype];
  if (!spec) return null;
  return spec.magic(buffer) ? spec : null;
}

/**
 * Sniff the real mime type from magic bytes alone — used for base64 JSON
 * uploads (offline queue) that carry no multipart content-type. Returns the
 * canonical mime or null when no allowed signature matches.
 */
export function sniffMime(buffer: Buffer): string | null {
  for (const [mime, spec] of Object.entries(ALLOWED_UPLOADS)) {
    if (spec.magic(buffer)) return mime;
  }
  return null;
}

/** Extension for an already-stored key, derived from the key's own extension. */
export function contentTypeForKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  const byExt = Object.values(ALLOWED_UPLOADS).find((u) => u.ext === ext);
  return byExt?.contentType ?? 'application/octet-stream';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates a storage key of shape `{tenantId}/{projectId}/{file}` and resolves
 * it inside uploadRoot. Returns null on any traversal/shape violation.
 */
export function resolveUploadPath(storageKey: string, uploadRoot: string): string | null {
  const parts = storageKey.split('/');
  if (parts.length !== 3) return null;
  const [tenantId, projectId, filename] = parts as [string, string, string];
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(projectId)) return null;
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
  const resolved = path.resolve(uploadRoot, tenantId, projectId, filename);
  const rootResolved = path.resolve(uploadRoot);
  if (!resolved.startsWith(rootResolved + path.sep)) return null;
  return resolved;
}

export function parseStorageKey(storageKey: string): { tenantId: string; projectId: string } | null {
  const parts = storageKey.split('/');
  if (parts.length !== 3) return null;
  const [tenantId, projectId] = parts as [string, string];
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(projectId)) return null;
  return { tenantId, projectId };
}
