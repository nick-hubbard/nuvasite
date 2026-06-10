import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for Password Credentials, built on Node's scrypt so no
 * native dependency is required. Hashes are self-describing strings:
 * scrypt$N$r$p$<salt-hex>$<hash-hex>, so parameters can change without
 * invalidating stored credentials.
 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export function hashPassword(plaintext: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plaintext, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    hash.toString("hex"),
  ].join("$");
}

export function verifyPassword(plaintext: string, stored: string): boolean {
  const [scheme, n, r, p, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(
    plaintext,
    Buffer.from(saltHex, "hex"),
    expected.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    },
  );
  return timingSafeEqual(actual, expected);
}
