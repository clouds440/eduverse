export interface UploadedFileInfo {
  id: string;
  path: string;
  filename: string;
  size: number;
  mimeType: string;
  entityType: string;
  entityId: string;
  orgId: string;
  publicId?: string;
  resourceType?: string;
  deliveryType?: string;
  fileKind?: string;
  extension?: string | null;
  sha256?: string | null;
  scanStatus?: string;
  uploadedBy: string;
  createdAt: Date;
  encryptedContent?: unknown;
}

export interface DeleteFileResult {
  message: string;
}
