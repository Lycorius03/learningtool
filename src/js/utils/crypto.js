/**
 * PaperLens — AES encryption wrapper for API key storage.
 * Uses Web Crypto API (SubtleCrypto) for client-side encryption.
 */
const ALGORITHM = 'AES-GCM';
const KEY_DERIVE_ALGO = 'PBKDF2';

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: KEY_DERIVE_ALGO, salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptApiKey(plainText, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(plainText)
  );

  // Pack: salt(16) + iv(12) + ciphertext
  const packed = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...packed));
}

export async function decryptApiKey(packedBase64, password) {
  try {
    const packed = Uint8Array.from(atob(packedBase64), c => c.charCodeAt(0));
    const salt = packed.slice(0, 16);
    const iv = packed.slice(16, 28);
    const ciphertext = packed.slice(28);

    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    throw new Error('解密失败：密码错误或数据损坏');
  }
}

/** Generate a device-specific encryption password */
export function getDevicePassword() {
  // Use a combination of user agent + screen info as a simple device fingerprint
  const fp = `${navigator.userAgent}|${screen.width}x${screen.height}|${navigator.language}`;
  return btoa(fp).slice(0, 32);
}
