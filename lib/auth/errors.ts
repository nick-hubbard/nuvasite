export class PasswordPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordPolicyError";
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`A User Account already exists for ${email}`);
    this.name = "EmailAlreadyInUseError";
  }
}
