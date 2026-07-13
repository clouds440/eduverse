import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { TextDecoder } from 'util';

export type UploadFileKind =
  | 'image'
  | 'document'
  | 'archive'
  | 'source'
  | 'text';

export interface FilePolicyResult {
  extension: string;
  fileKind: UploadFileKind;
  resourceType: 'image' | 'raw';
  sizeLimitBytes: number;
  sha256: string;
}

export const CODE_MAX_SIZE_BYTES = Math.floor(1.5 * 1024 * 1024);
export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024;

export const GENERIC_UPLOAD_ACCEPT_EXTENSIONS = [
  '.c',
  '.cpp',
  '.cs',
  '.css',
  '.doc',
  '.docx',
  '.gif',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.pdf',
  '.php',
  '.png',
  '.ppt',
  '.pptx',
  '.py',
  '.rb',
  '.rs',
  '.sql',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.webp',
  '.xls',
  '.xlsx',
  '.xml',
  '.zip',
] as const;

const BLOCKED_EXTENSIONS = new Set([
  '.action',
  '.apk',
  '.app',
  '.bat',
  '.bin',
  '.cmd',
  '.com',
  '.command',
  '.cpl',
  '.csh',
  '.dll',
  '.exe',
  '.gadget',
  '.inf',
  '.ins',
  '.inx',
  '.ipa',
  '.isu',
  '.jar',
  '.job',
  '.jse',
  '.ksh',
  '.lnk',
  '.msc',
  '.msi',
  '.msp',
  '.mst',
  '.osx',
  '.out',
  '.paf',
  '.pif',
  '.prg',
  '.ps1',
  '.reg',
  '.rgs',
  '.run',
  '.sct',
  '.sh',
  '.shb',
  '.shs',
  '.so',
  '.u3p',
  '.vb',
  '.vbe',
  '.vbs',
  '.vbscript',
  '.wasm',
  '.workflow',
  '.ws',
  '.wsf',
]);

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
]);
const ARCHIVE_EXTENSIONS = new Set(['.zip']);
const SOURCE_EXTENSIONS = new Set([
  '.c',
  '.cpp',
  '.cs',
  '.css',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.php',
  '.py',
  '.rb',
  '.rs',
  '.sql',
  '.svg',
  '.ts',
  '.tsx',
  '.xml',
]);
const TEXT_EXTENSIONS = new Set(['.txt']);

const ALLOWED_EXTENSIONS = new Set<string>([
  ...GENERIC_UPLOAD_ACCEPT_EXTENSIONS,
]);

const IMAGE_MIME_BY_EXTENSION: Record<string, Set<string>> = {
  '.gif': new Set(['image/gif']),
  '.jpeg': new Set(['image/jpeg']),
  '.jpg': new Set(['image/jpeg']),
  '.png': new Set(['image/png']),
  '.webp': new Set(['image/webp']),
};

const DOCUMENT_MIME_BY_EXTENSION: Record<string, Set<string>> = {
  '.doc': new Set(['application/msword']),
  '.docx': new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  '.pdf': new Set(['application/pdf']),
  '.ppt': new Set(['application/vnd.ms-powerpoint']),
  '.pptx': new Set([
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]),
  '.xls': new Set(['application/vnd.ms-excel']),
  '.xlsx': new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  '.zip': new Set(['application/zip', 'application/x-zip-compressed']),
};

const TEXT_LIKE_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'application/json',
  'application/javascript',
  'application/sql',
  'application/typescript',
  'application/xml',
  'application/x-javascript',
  'application/x-python-code',
  'image/svg+xml',
  'text/css',
  'text/html',
  'text/javascript',
  'text/jsx',
  'text/markdown',
  'text/plain',
  'text/tsx',
  'text/typescript',
  'text/x-c',
  'text/x-c++src',
  'text/x-csrc',
  'text/x-java-source',
  'text/x-python',
  'text/x-typescript',
  'text/xml',
  'video/mp2t',
]);

const IMAGE_ONLY_ENTITY_TYPES = new Set(['chat_avatar']);
const FINANCE_ENTITY_TYPES = new Set([
  'FINANCE_PAYMENT_CLAIM',
  'FINANCE_PAYMENT_CONFIRMATION',
  'FINANCE_TRANSACTION_ATTACHMENT',
]);

export function getUploadAcceptAttribute() {
  return GENERIC_UPLOAD_ACCEPT_EXTENSIONS.join(',');
}

export function classifyAndValidateUpload(
  file: Express.Multer.File,
  entityType: string,
  sha256: string,
): FilePolicyResult {
  const extension = extname(file.originalname || '').toLowerCase();
  if (!extension) {
    throw new BadRequestException('Uploaded files must include an extension.');
  }

  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new BadRequestException(
      `File extension "${extension}" is not allowed.`,
    );
  }

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new BadRequestException(
      `File extension "${extension}" is not supported for uploads.`,
    );
  }

  const fileKind = resolveFileKind(extension);
  if (IMAGE_ONLY_ENTITY_TYPES.has(entityType) && fileKind !== 'image') {
    throw new BadRequestException('This upload only accepts image files.');
  }

  if (
    FINANCE_ENTITY_TYPES.has(entityType) &&
    fileKind !== 'image' &&
    !(fileKind === 'document' && extension === '.pdf')
  ) {
    throw new BadRequestException(
      'Finance attachments only accept images and PDF files.',
    );
  }

  validateMimeType(extension, file.mimetype || '', fileKind);
  if (fileKind === 'source' || fileKind === 'text') {
    validateTextLikeBuffer(file.buffer);
  }

  const sizeLimitBytes =
    fileKind === 'source' || fileKind === 'text'
      ? CODE_MAX_SIZE_BYTES
      : fileKind === 'image'
        ? IMAGE_MAX_SIZE_BYTES
        : DEFAULT_MAX_SIZE_BYTES;

  if (file.size > sizeLimitBytes) {
    throw new BadRequestException(
      `File too large. Maximum allowed size for this file type is ${formatLimit(sizeLimitBytes)}.`,
    );
  }

  return {
    extension,
    fileKind,
    resourceType: fileKind === 'image' ? 'image' : 'raw',
    sizeLimitBytes,
    sha256,
  };
}

function resolveFileKind(extension: string): UploadFileKind {
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  if (ARCHIVE_EXTENSIONS.has(extension)) return 'archive';
  if (SOURCE_EXTENSIONS.has(extension)) return 'source';
  if (TEXT_EXTENSIONS.has(extension)) return 'text';

  throw new BadRequestException(
    `File extension "${extension}" is not supported for uploads.`,
  );
}

function validateMimeType(
  extension: string,
  mimeType: string,
  fileKind: UploadFileKind,
) {
  const normalizedMime = mimeType.split(';')[0].trim().toLowerCase();

  if (fileKind === 'source' || fileKind === 'text') {
    if (!TEXT_LIKE_MIME_TYPES.has(normalizedMime)) {
      throw new BadRequestException(
        `File type "${mimeType}" does not match a text/code upload.`,
      );
    }
    return;
  }

  const allowedMimes =
    IMAGE_MIME_BY_EXTENSION[extension] || DOCUMENT_MIME_BY_EXTENSION[extension];

  if (allowedMimes && !allowedMimes.has(normalizedMime)) {
    throw new BadRequestException(
      `File type "${mimeType}" does not match extension "${extension}".`,
    );
  }
}

function validateTextLikeBuffer(buffer?: Buffer) {
  if (!buffer || buffer.length === 0) return;

  if (buffer.includes(0)) {
    throw new BadRequestException('Code/text uploads cannot contain null bytes.');
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new BadRequestException('Code/text uploads must be valid UTF-8.');
  }

  let suspiciousControlChars = 0;
  for (const byte of buffer) {
    const isAllowedWhitespace = byte === 9 || byte === 10 || byte === 13;
    if (byte < 32 && !isAllowedWhitespace) suspiciousControlChars += 1;
  }

  if (suspiciousControlChars / buffer.length > 0.01) {
    throw new BadRequestException(
      'Code/text uploads contain too many control characters.',
    );
  }
}

function formatLimit(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${Number(mb.toFixed(1))} MB`;
}
