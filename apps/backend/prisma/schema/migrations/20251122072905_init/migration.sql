-- CreateEnum
CREATE TYPE "AdminApiType" AS ENUM ('DIRECTORY', 'API');

-- CreateEnum
CREATE TYPE "AdminApiMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- CreateEnum
CREATE TYPE "AdminMenuType" AS ENUM ('DIRECTORY', 'MENU', 'FEATURE');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'CLAIMED', 'SENT', 'RETRY', 'DEAD');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('email');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'suspended', 'banned');

-- CreateEnum
CREATE TYPE "VerificationCodePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "AdminApi" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "AdminApiType" NOT NULL,
    "title" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50),
    "method" "AdminApiMethod",
    "path" VARCHAR(100),
    "description" VARCHAR(100),
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminApi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "snapshot" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminMenu" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "AdminMenuType" NOT NULL,
    "title" VARCHAR(50) NOT NULL,
    "icon" VARCHAR(50),
    "code" VARCHAR(50),
    "path" VARCHAR(100),
    "description" VARCHAR(100),
    "i18nKey" VARCHAR(50),
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isShow" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(100),
    "menuPermissions" TEXT[],
    "featurePermissions" TEXT[],
    "apiPermissions" TEXT[],
    "createTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(200) NOT NULL,
    "nickName" VARCHAR(50),
    "email" VARCHAR(50),
    "headPic" VARCHAR(100),
    "phone" VARCHAR(20),
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "createTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "new_admin_user_roles" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "new_admin_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" BIGSERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextVisibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT,
    "correlationId" TEXT,
    "partitionKey" TEXT,
    "priority" INTEGER,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "nickname" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CredentialType" NOT NULL,
    "value" TEXT NOT NULL,
    "secret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" "VerificationCodePurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminApi_code_key" ON "AdminApi"("code");

-- CreateIndex
CREATE INDEX "audit_logs_type_created_at_idx" ON "audit_logs"("type", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_user_id_idx" ON "audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_operator_id_idx" ON "audit_logs"("operator_id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminMenu_code_key" ON "AdminMenu"("code");

-- CreateIndex
CREATE INDEX "AdminMenu_parentId_idx" ON "AdminMenu"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminMenu_parentId_title_key" ON "AdminMenu"("parentId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_code_key" ON "AdminRole"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_name_key" ON "AdminRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUserRole_roleId_idx" ON "AdminUserRole"("roleId");

-- CreateIndex
CREATE INDEX "AdminUserRole_userId_idx" ON "AdminUserRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserRole_userId_roleId_key" ON "AdminUserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "new_admin_user_roles_adminUserId_roleId_key" ON "new_admin_user_roles"("adminUserId", "roleId");

-- CreateIndex
CREATE INDEX "OutboxMessage_status_nextVisibleAt_idx" ON "OutboxMessage"("status", "nextVisibleAt");

-- CreateIndex
CREATE INDEX "OutboxMessage_topic_idx" ON "OutboxMessage"("topic");

-- CreateIndex
CREATE INDEX "OutboxMessage_dedupeKey_idx" ON "OutboxMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxMessage_correlationId_idx" ON "OutboxMessage"("correlationId");

-- CreateIndex
CREATE INDEX "OutboxMessage_createdAt_idx" ON "OutboxMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_credentials_type_value_key" ON "user_credentials"("type", "value");

-- CreateIndex
CREATE INDEX "verification_codes_email_purpose_idx" ON "verification_codes"("email", "purpose");

-- CreateIndex
CREATE INDEX "verification_codes_code_idx" ON "verification_codes"("code");

-- CreateIndex
CREATE INDEX "verification_codes_expires_at_idx" ON "verification_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "AdminApi" ADD CONSTRAINT "AdminApi_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AdminApi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMenu" ADD CONSTRAINT "AdminMenu_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AdminMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRole" ADD CONSTRAINT "AdminUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRole" ADD CONSTRAINT "AdminUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "new_admin_user_roles" ADD CONSTRAINT "new_admin_user_roles_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "new_admin_user_roles" ADD CONSTRAINT "new_admin_user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
