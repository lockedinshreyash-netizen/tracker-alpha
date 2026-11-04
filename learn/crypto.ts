/* ── The library's lock ──
   Every record is sealed with AES-GCM before it reaches IndexedDB, under one
   key per account. The key is held by the server (Phase 3: `learn_keys`) and
   cached on this device as a non-extractable CryptoKey: the app can use it
   offline, but no script can read its bytes back out. Sign-out deletes the
   cached key, so what stays on the device is ciphertext nobody here can open;
   signing back in fetches the key and the library returns. Deleting the
   account deletes the server's key, and every copy becomes unreadable.

   Each record is sealed to its slot (`lectures:lec_abc`): the slot is the
   AES-GCM additional data, so a record copied into another row, or another
   store, fails to open instead of turning into something else.

   What this does not protect against: someone at this browser while the
   account is signed in, or a script injected into the app. Nothing on the web
   does. Plain WebCrypto, available in every browser Alpha supports and in
   Node for the tests. */

export const KEY_BYTES = 32;
const IV_BYTES = 12;
const CHECK_TEXT = 'alpha-learn-key-check/1';
export const CHECK_SLOT = 'kv:check';

export interface Sealed {
  iv: Uint8Array;
  data: ArrayBuffer;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export const generateRawKey = (): Uint8Array => crypto.getRandomValues(new Uint8Array(KEY_BYTES));

/** Non-extractable: once imported, the key's bytes cannot be read back by any script. */
export const importKey = (raw: Uint8Array): Promise<CryptoKey> => {
  if (raw.byteLength !== KEY_BYTES) return Promise.reject(new Error('bad key length'));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

export const seal = async (key: CryptoKey, slot: string, value: unknown): Promise<Sealed> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(slot) },
    key,
    enc.encode(JSON.stringify(value)),
  );
  return { iv, data };
};

/** Throws if the key is wrong, the slot is wrong, or a byte was changed. */
export const unseal = async (key: CryptoKey, slot: string, sealed: Sealed): Promise<unknown> => {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv, additionalData: enc.encode(slot) },
    key,
    sealed.data,
  );
  return JSON.parse(dec.decode(plain));
};

/** Written once, when a library is created, so a wrong key is caught before anything is shown. */
export const makeCheck = (key: CryptoKey): Promise<Sealed> => seal(key, CHECK_SLOT, CHECK_TEXT);

export const verifyCheck = async (key: CryptoKey, sealed: Sealed): Promise<boolean> => {
  try {
    return (await unseal(key, CHECK_SLOT, sealed)) === CHECK_TEXT;
  } catch {
    return false;
  }
};

export const isSealed = (v: unknown): v is Sealed =>
  !!v && typeof v === 'object' && (v as Sealed).iv instanceof Uint8Array && (v as Sealed).data instanceof ArrayBuffer;

/* The key travels from the server as base64 (Phase 3). */
export const keyToB64 = (raw: Uint8Array): string => {
  let s = '';
  raw.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
};

export const keyFromB64 = (b64: string): Uint8Array | null => {
  try {
    const bin = atob(b64);
    if (bin.length !== KEY_BYTES) return null;
    return Uint8Array.from(bin, c => c.charCodeAt(0));
  } catch {
    return null;
  }
};
