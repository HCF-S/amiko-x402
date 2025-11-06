-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "x402";

-- CreateTable
CREATE TABLE "x402"."agents" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
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

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x402"."agent_services" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "service_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_address_key" ON "x402"."agents"("address");

-- AddForeignKey
ALTER TABLE "x402"."agent_services" ADD CONSTRAINT "agent_services_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "x402"."agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
