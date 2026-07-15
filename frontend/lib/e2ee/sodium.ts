import type sodiumModule from 'libsodium-wrappers';

export type SodiumModule = typeof sodiumModule;

let sodiumPromise: Promise<SodiumModule> | null = null;

export async function loadSodium() {
    sodiumPromise ??= import('libsodium-wrappers').then(async (module) => {
        const sodium = (module.default || module) as unknown as SodiumModule;
        await sodium.ready;
        return sodium;
    });
    return sodiumPromise;
}

export function encodeBase64(sodium: SodiumModule, value: Uint8Array) {
    return sodium.to_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export function decodeBase64(sodium: SodiumModule, value: string) {
    return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export function fingerprintBytes(sodium: SodiumModule, value: Uint8Array) {
    return encodeBase64(sodium, sodium.crypto_generichash(16, value, null));
}

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export function canonicalizeJson(value: JsonValue): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(',')}]`;

    return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`)
        .join(',')}}`;
}

export function encodeAssociatedData(value?: JsonValue | null) {
    return value === undefined || value === null ? null : canonicalizeJson(value);
}
