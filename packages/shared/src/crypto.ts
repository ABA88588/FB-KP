export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

const aesGcmAlgorithm = "AES-GCM";
const aesGcmTagLengthBits = 128;
const aesGcmTagLengthBytes = 16;
const aesGcmIvLengthBytes = 12;

export function decodeBase64(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function decodeAesKey(base64Key: string): Uint8Array {
  const key = decodeBase64(base64Key);
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  return key;
}

export function generateAes256GcmKeyBase64(): string {
  const bytes = new Uint8Array(32);
  getRuntimeCrypto().getRandomValues(bytes);
  return encodeBase64(bytes);
}

export async function encryptToken(plainText: string, base64Key: string, keyVersion = "v1"): Promise<EncryptedSecret> {
  const iv = new Uint8Array(aesGcmIvLengthBytes);
  getRuntimeCrypto().getRandomValues(iv);
  const key = await importAesKey(base64Key);
  const encrypted = new Uint8Array(
    await getRuntimeCrypto().subtle.encrypt(
      { name: aesGcmAlgorithm, iv: asArrayBuffer(iv), tagLength: aesGcmTagLengthBits },
      key,
      asArrayBuffer(new TextEncoder().encode(plainText))
    )
  );
  const ciphertext = encrypted.slice(0, encrypted.length - aesGcmTagLengthBytes);
  const authTag = encrypted.slice(encrypted.length - aesGcmTagLengthBytes);
  return {
    ciphertext: encodeBase64(ciphertext),
    iv: encodeBase64(iv),
    authTag: encodeBase64(authTag),
    keyVersion
  };
}

export async function decryptToken(secret: EncryptedSecret, base64Key: string): Promise<string> {
  const key = await importAesKey(base64Key);
  const ciphertext = decodeBase64(secret.ciphertext);
  const authTag = decodeBase64(secret.authTag);
  const encrypted = new Uint8Array(ciphertext.length + authTag.length);
  encrypted.set(ciphertext);
  encrypted.set(authTag, ciphertext.length);

  const plainText = await getRuntimeCrypto().subtle.decrypt(
    { name: aesGcmAlgorithm, iv: asArrayBuffer(decodeBase64(secret.iv)), tagLength: aesGcmTagLengthBits },
    key,
    asArrayBuffer(encrypted)
  );
  return new TextDecoder().decode(plainText);
}

export const encryptSecret = encryptToken;
export const decryptSecret = decryptToken;

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  return getRuntimeCrypto().subtle.importKey("raw", asArrayBuffer(decodeAesKey(base64Key)), { name: aesGcmAlgorithm }, false, ["encrypt", "decrypt"]);
}

function getRuntimeCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto API is required for token encryption");
  return globalThis.crypto;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
