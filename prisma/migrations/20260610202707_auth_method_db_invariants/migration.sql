-- Manual database-level invariants for Auth Methods and Password Credentials.
--
-- Prisma's schema language cannot express conditional column requirements or
-- cross-table type checks, so this migration adds them as raw SQL. They are
-- the last line of defense for invariants the application layer also
-- enforces (see PRD issue #1 and implementation issue #6):
--
--   1. A GOOGLE Auth Method must carry the OAuth Provider Identity
--      (Google `sub`) in provider_account_id.
--   2. An EMAIL_PASSWORD Auth Method must never carry a provider account id;
--      its secret lives in user_password_credential instead.
--   3. A Password Credential may only ever reference an EMAIL_PASSWORD Auth
--      Method. A foreign key cannot express "referenced row must have this
--      type", so a trigger checks the target row's method_type on INSERT and
--      UPDATE of user_password_credential.

-- Invariants 1 and 2: provider_account_id presence must match method type.
ALTER TABLE "user_auth_method"
  ADD CONSTRAINT "user_auth_method_provider_account_id_presence_check"
  CHECK (
    ("method_type" = 'GOOGLE' AND "provider_account_id" IS NOT NULL)
    OR ("method_type" = 'EMAIL_PASSWORD' AND "provider_account_id" IS NULL)
  );

-- Invariant 3: Password Credentials may only reference EMAIL_PASSWORD
-- Auth Methods.
CREATE OR REPLACE FUNCTION enforce_password_credential_method_type()
RETURNS trigger AS $$
DECLARE
  target_method_type "user_auth_method_type";
BEGIN
  SELECT "method_type" INTO target_method_type
  FROM "user_auth_method"
  WHERE "user_auth_method_id" = NEW."user_auth_method_id";

  IF target_method_type IS DISTINCT FROM 'EMAIL_PASSWORD' THEN
    RAISE EXCEPTION
      'user_password_credential may only reference EMAIL_PASSWORD auth methods (got %)',
      target_method_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_password_credential_method_type_check
  BEFORE INSERT OR UPDATE OF "user_auth_method_id"
  ON "user_password_credential"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_password_credential_method_type();

-- Guard the other direction too: an EMAIL_PASSWORD Auth Method must not be
-- retyped to GOOGLE while a Password Credential still references it.
CREATE OR REPLACE FUNCTION enforce_auth_method_type_credential_consistency()
RETURNS trigger AS $$
BEGIN
  IF NEW."method_type" <> 'EMAIL_PASSWORD' AND EXISTS (
    SELECT 1 FROM "user_password_credential"
    WHERE "user_auth_method_id" = NEW."user_auth_method_id"
  ) THEN
    RAISE EXCEPTION
      'auth method % still owns a password credential and must stay EMAIL_PASSWORD',
      NEW."user_auth_method_id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_auth_method_type_credential_consistency_check
  BEFORE UPDATE OF "method_type"
  ON "user_auth_method"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_auth_method_type_credential_consistency();
