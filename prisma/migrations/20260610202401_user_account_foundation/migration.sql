-- CreateEnum
CREATE TYPE "user_account_status" AS ENUM ('ACTIVE', 'DISABLED', 'BANNED', 'REMOVED');

-- CreateEnum
CREATE TYPE "user_auth_method_type" AS ENUM ('EMAIL_PASSWORD', 'GOOGLE');

-- CreateTable
CREATE TABLE "user_account" (
    "user_account_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "status" "user_account_status" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("user_account_id")
);

-- CreateTable
CREATE TABLE "user_auth_method" (
    "user_auth_method_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_account_id" UUID NOT NULL,
    "method_type" "user_auth_method_type" NOT NULL,
    "provider_account_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_auth_method_pkey" PRIMARY KEY ("user_auth_method_id")
);

-- CreateTable
CREATE TABLE "user_password_credential" (
    "user_password_credential_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_auth_method_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_password_credential_pkey" PRIMARY KEY ("user_password_credential_id")
);

-- CreateTable
CREATE TABLE "user_account_status_change" (
    "user_account_status_change_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_account_id" UUID NOT NULL,
    "previous_status" "user_account_status",
    "new_status" "user_account_status" NOT NULL,
    "changed_by_user_account_id" UUID,
    "reason" TEXT,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_status_change_pkey" PRIMARY KEY ("user_account_status_change_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_email_key" ON "user_account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_method_user_account_id_method_type_key" ON "user_auth_method"("user_account_id", "method_type");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_method_method_type_provider_account_id_key" ON "user_auth_method"("method_type", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_password_credential_user_auth_method_id_key" ON "user_password_credential"("user_auth_method_id");

-- CreateIndex
CREATE INDEX "user_account_status_change_user_account_id_changed_at_idx" ON "user_account_status_change"("user_account_id", "changed_at");

-- AddForeignKey
ALTER TABLE "user_auth_method" ADD CONSTRAINT "user_auth_method_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("user_account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_password_credential" ADD CONSTRAINT "user_password_credential_user_auth_method_id_fkey" FOREIGN KEY ("user_auth_method_id") REFERENCES "user_auth_method"("user_auth_method_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_status_change" ADD CONSTRAINT "user_account_status_change_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("user_account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_status_change" ADD CONSTRAINT "user_account_status_change_changed_by_user_account_id_fkey" FOREIGN KEY ("changed_by_user_account_id") REFERENCES "user_account"("user_account_id") ON DELETE SET NULL ON UPDATE CASCADE;
