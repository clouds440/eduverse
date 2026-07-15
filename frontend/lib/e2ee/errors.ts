export type E2EEErrorCode =
    | 'NO_TRUSTED_DEVICE'
    | 'RECIPIENT_NO_TRUSTED_DEVICE'
    | 'NO_KEY_ENVELOPE'
    | 'REVOKED_DEVICE'
    | 'CORRUPT_CIPHERTEXT'
    | 'UNSUPPORTED_ENCRYPTION_VERSION'
    | 'INVALID_KEY_MATERIAL';

export class E2EEError extends Error {
    code: E2EEErrorCode;

    constructor(code: E2EEErrorCode, message: string) {
        super(message);
        this.name = 'E2EEError';
        this.code = code;
    }
}
