import { api, API_BASE_URL } from "@/lib/api";
import { getDeviceId } from "@/lib/deviceUtils";
import type {
  Attachment,
  EncryptedMailContent,
  RecipientEncryptionDevicesResponse,
} from "@/types";
import {
  E2EE_CONTENT_ALGORITHM,
  E2EE_CONTENT_KEY_VERSION,
  E2EE_ENCRYPTION_VERSION,
  decryptStringContent,
} from "./contentCrypto";
import { E2EEError } from "./errors";
import {
  getLocalTrustedDeviceKeys,
  getUserIdFromToken,
} from "./localDeviceKeys";
import {
  unwrapContentKeyFromDeviceEnvelope,
  wrapContentKeyForDevice,
} from "./keyEnvelopeCrypto";
import {
  assertRecipientDeviceCoverage,
  findCurrentTrustedDevice,
  flattenTrustedRecipientDevices,
} from "./recipientDevices";
import {
  decodeBase64,
  encodeAssociatedData,
  encodeBase64,
  loadSodium,
  type JsonValue,
} from "./sodium";

export interface PrepareEncryptedFileUploadOptions {
  file: File;
  recipientDevices: RecipientEncryptionDevicesResponse[];
  currentUserId: string;
  scope: "CHAT_ATTACHMENT" | "MAIL_ATTACHMENT";
  entityType: string;
  entityId: string;
  allowPartialRecipients?: boolean;
}

export interface EncryptedFileUpload {
  file: File;
  encryptedContent: EncryptedMailContent;
}

function bytesToBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function prepareEncryptedFileUpload({
  file,
  recipientDevices,
  currentUserId,
  scope,
  entityType,
  entityId,
  allowPartialRecipients = false,
}: PrepareEncryptedFileUploadOptions): Promise<EncryptedFileUpload> {
  const clientDeviceId = getDeviceId();
  if (!allowPartialRecipients) {
    assertRecipientDeviceCoverage(
      recipientDevices,
      recipientDevices.map((recipient) => recipient.userId),
      "Attachment",
    );
  }

  if (!clientDeviceId) {
    throw new E2EEError(
      "NO_TRUSTED_DEVICE",
      "This browser is not ready for secure attachments.",
    );
  }

  const localKeys = await getLocalTrustedDeviceKeys(
    currentUserId,
    clientDeviceId,
  );
  if (!localKeys) {
    throw new E2EEError(
      "NO_TRUSTED_DEVICE",
      "Trust this browser before sending secure attachments.",
    );
  }

  const senderDevice = findCurrentTrustedDevice(
    recipientDevices,
    currentUserId,
    clientDeviceId,
  );
  if (!senderDevice) {
    throw new E2EEError(
      "NO_TRUSTED_DEVICE",
      "This browser is still waiting for approval.",
    );
  }

  const deviceRecipients = flattenTrustedRecipientDevices(recipientDevices);
  if (deviceRecipients.length === 0) {
    throw new E2EEError(
      "NO_TRUSTED_DEVICE",
      "No approved browsers are available for this attachment.",
    );
  }

  const sodium = await loadSodium();
  const fileKey = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
  );
  const fileNonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  const metadataNonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  const associatedData = {
    scope,
    entityType,
    entityId,
    senderId: currentUserId,
    encryptionVersion: E2EE_ENCRYPTION_VERSION,
    fileNonce: encodeBase64(sodium, fileNonce),
  };
  const additionalData = encodeAssociatedData(associatedData);

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    fileBytes,
    additionalData,
    null,
    fileNonce,
    fileKey,
  );

  const metadata = JSON.stringify({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified,
  });
  const metadataCiphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    new TextEncoder().encode(metadata),
    additionalData,
    null,
    metadataNonce,
    fileKey,
  );

  const keyEnvelopes = await Promise.all(
    deviceRecipients.map(async ({ userId, device }) => {
      const envelope = await wrapContentKeyForDevice({
        contentKey: fileKey,
        recipientPublicKey: device.keyAgreementPublicKey,
        senderPrivateKey: localKeys.keyAgreementPrivateKey,
        deviceKeyVersion: device.keyVersion,
        associatedData: {
          ...associatedData,
          recipientUserId: userId,
          trustedDeviceId: device.id,
          senderDeviceId: senderDevice.id,
        },
      });

      return {
        recipientUserId: userId,
        trustedDeviceId: device.id,
        senderDeviceId: senderDevice.id,
        deviceKeyVersion: envelope.deviceKeyVersion,
        algorithm: envelope.algorithm,
        wrappedKey: envelope.wrappedKey,
        nonce: envelope.nonce,
        associatedData: envelope.associatedData as Record<string, unknown>,
      };
    }),
  );

  return {
    file: new File([bytesToBlobPart(ciphertext)], file.name, {
      type: "application/octet-stream",
    }),
    encryptedContent: {
      contentType: "FILE_ATTACHMENT",
      encryptionVersion: E2EE_ENCRYPTION_VERSION,
      algorithm: E2EE_CONTENT_ALGORITHM,
      ciphertext: encodeBase64(sodium, metadataCiphertext),
      nonce: encodeBase64(sodium, metadataNonce),
      associatedData: associatedData as Record<string, unknown>,
      contentKeyVersion: E2EE_CONTENT_KEY_VERSION,
      keyEnvelopes,
    },
  };
}

export async function downloadEncryptedAttachment(
  fileId: string,
  token: string,
) {
  const metadata = await api.files.getMetadata(fileId, token);
  const encryptedContent = metadata.encryptedContent as
    | EncryptedMailContent
    | null
    | undefined;
  if (!encryptedContent?.ciphertext) {
    throw new E2EEError("NO_KEY_ENVELOPE", "This file is not encrypted.");
  }

  const fileKey = await unwrapFileKey(encryptedContent, token);
  const plaintextMetadata = await decryptStringContent(
    {
      encryptionVersion: encryptedContent.encryptionVersion,
      algorithm: encryptedContent.algorithm,
      ciphertext: encryptedContent.ciphertext,
      nonce: encryptedContent.nonce,
      authTag: encryptedContent.authTag || null,
      associatedData: (encryptedContent.associatedData || undefined) as
        | JsonValue
        | undefined,
      contentKeyVersion:
        encryptedContent.contentKeyVersion || E2EE_CONTENT_KEY_VERSION,
    },
    fileKey,
  );
  const parsedMetadata = JSON.parse(plaintextMetadata) as {
    filename?: string;
    mimeType?: string;
  };

  const response = await fetch(`${API_BASE_URL}/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Download failed with ${response.status}`);
  const encryptedBytes = new Uint8Array(await response.arrayBuffer());
  const associatedData = encryptedContent.associatedData as
    | Record<string, unknown>
    | null
    | undefined;
  const fileNonce =
    typeof associatedData?.fileNonce === "string"
      ? associatedData.fileNonce
      : null;
  if (!fileNonce) {
    throw new E2EEError(
      "CORRUPT_CIPHERTEXT",
      "Encrypted file metadata is missing its nonce.",
    );
  }

  const sodium = await loadSodium();
  const decryptedBytes = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    encryptedBytes,
    encodeAssociatedData(
      encryptedContent.associatedData as JsonValue | undefined,
    ),
    decodeBase64(sodium, fileNonce),
    decodeBase64(sodium, fileKey),
  );
  const blob = new Blob([bytesToBlobPart(decryptedBytes)], {
    type: parsedMetadata.mimeType || "application/octet-stream",
  });
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download =
    parsedMetadata.filename || metadata.filename || "attachment";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 0);
}

async function unwrapFileKey(
  encryptedContent: EncryptedMailContent,
  token: string,
) {
  const clientDeviceId = getDeviceId();
  if (!clientDeviceId) {
    throw new E2EEError(
      "NO_TRUSTED_DEVICE",
      "This browser is not ready for secure attachments.",
    );
  }
  const tokenUserId = getUserIdFromToken(token);
  const [localKeys, devices] = await Promise.all([
    getLocalTrustedDeviceKeys(tokenUserId, clientDeviceId),
    api.e2ee.getMyDevices(token),
  ]);
  const currentDevice = devices.devices.find(
    (device) =>
      device.clientDeviceId === clientDeviceId &&
      device.trustStatus === "TRUSTED" &&
      !device.revokedAt &&
      device.trustedAt,
  );
  if (!localKeys || !currentDevice) {
    throw new E2EEError(
      "NO_TRUSTED_DEVICE",
      "This browser is not approved for secure attachments.",
    );
  }

  const envelope = encryptedContent.keyEnvelopes?.find(
    (candidate) =>
      candidate.trustedDeviceId === currentDevice.id ||
      candidate.trustedDevice?.clientDeviceId === clientDeviceId,
  );
  const senderPublicKey = envelope?.senderDevice?.keyAgreementPublicKey;
  if (!envelope || !senderPublicKey) {
    throw new E2EEError(
      "NO_KEY_ENVELOPE",
      "This attachment can't be opened here.",
    );
  }

  return unwrapContentKeyFromDeviceEnvelope({
    envelope: {
      algorithm: envelope.algorithm,
      wrappedKey: envelope.wrappedKey,
      nonce: envelope.nonce || "",
      associatedData: (envelope.associatedData || undefined) as
        | JsonValue
        | undefined,
      deviceKeyVersion: envelope.deviceKeyVersion,
    },
    senderPublicKey,
    recipientPrivateKey: localKeys.keyAgreementPrivateKey,
  });
}

export function getFileIdFromDownloadUrl(url: string) {
  const match = url.match(/\/files\/([^/]+)\/download/);
  return match?.[1] || null;
}
