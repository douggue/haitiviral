ALTER TABLE "ProductVariant" ADD COLUMN "account" JSONB;
ALTER TABLE "ProviderService" ADD COLUMN "stock" INTEGER, ADD COLUMN "require" TEXT;
