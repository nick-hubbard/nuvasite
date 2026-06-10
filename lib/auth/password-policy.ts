import { PasswordPolicyError } from "./errors";

/**
 * v1 password policy: at least 8 characters with at least one special,
 * one uppercase, and one lowercase character. Validated before hashing so
 * weak passwords are rejected early.
 */
export function assertPasswordMeetsPolicy(password: string): void {
  if (password.length < 8) {
    throw new PasswordPolicyError("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    throw new PasswordPolicyError(
      "Password must contain at least one uppercase character",
    );
  }
  if (!/[a-z]/.test(password)) {
    throw new PasswordPolicyError(
      "Password must contain at least one lowercase character",
    );
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new PasswordPolicyError(
      "Password must contain at least one special character",
    );
  }
}
