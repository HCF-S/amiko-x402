-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "x402";

-- CreateTable
CREATE TABLE "x402"."agents" (
    "wallet" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata_uri" TEXT,
    "metadata_json" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "auto_created" BOOLEAN NOT NULL DEFAULT false,
    "total_weighted_rating" DECIMAL(39,0) NOT NULL DEFAULT 0,
    "total_weight" DECIMAL(39,0) NOT NULL DEFAULT 0,
    "avg_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_update" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "x402"."agent_services" (
    "id" TEXT NOT NULL,
    "agent_wallet" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "method" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402"."job_records" (
    "id" TEXT NOT NULL,
    "client_wallet" TEXT NOT NULL,
    "agent_wallet" TEXT NOT NULL,
    "payment_tx" TEXT NOT NULL,
    "payment_amount" DECIMAL(20,0) NOT NULL,
    "created_at_chain" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402"."feedback_records" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "client_wallet" TEXT NOT NULL,
    "agent_wallet" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment_uri" TEXT,
    "proof_of_payment" TEXT NOT NULL,
    "payment_amount" DECIMAL(20,0) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_wallet_key" ON "x402"."agents"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "agent_services_agent_wallet_url_key" ON "x402"."agent_services"("agent_wallet", "url");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_records_job_id_key" ON "x402"."feedback_records"("job_id");

-- AddForeignKey
ALTER TABLE "x402"."agent_services" ADD CONSTRAINT "agent_services_agent_wallet_fkey" FOREIGN KEY ("agent_wallet") REFERENCES "x402"."agents"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402"."job_records" ADD CONSTRAINT "job_records_agent_wallet_fkey" FOREIGN KEY ("agent_wallet") REFERENCES "x402"."agents"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402"."feedback_records" ADD CONSTRAINT "feedback_records_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "x402"."job_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x402"."feedback_records" ADD CONSTRAINT "feedback_records_agent_wallet_fkey" FOREIGN KEY ("agent_wallet") REFERENCES "x402"."agents"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;
