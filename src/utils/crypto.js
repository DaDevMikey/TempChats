// ==========================================================================
// Client-Side End-to-End Encryption Helper for Private Rooms
// Uses Web Crypto API (AES-GCM 256-bit) with Room Code Key Derivation
// ==========================================================================

const ENC_PREFIX = '[E2EE]:';

async function deriveKey(secretCode) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secretCode),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Use fixed salt derived from secret string
  const salt = enc.encode(`tempchats-salt-${secretCode}`);

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(plaintext, secretCode) {
  if (!plaintext || !secretCode) return plaintext;
  try {
    const key = await deriveKey(secretCode);
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(plaintext)
    );

    const ivArray = Array.from(iv);
    const dataArray = Array.from(new Uint8Array(encryptedBuffer));
    const combined = JSON.stringify({ iv: ivArray, data: dataArray });
    const b64 = btoa(combined);
    return `${ENC_PREFIX}${b64}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return plaintext;
  }
}

export async function decryptText(ciphertext, secretCode) {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith(ENC_PREFIX) || !secretCode) {
    return ciphertext;
  }

  try {
    const rawB64 = ciphertext.slice(ENC_PREFIX.length);
    const jsonStr = atob(rawB64);
    const { iv, data } = JSON.parse(jsonStr);

    const key = await deriveKey(secretCode);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '🔒 [Encrypted Message — Cannot Decrypt]';
  }
}
