/*
  Warnings:

  - You are about to drop the column `service_url` on the `agent_services` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[agent_id,url]` on the table `agent_services` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `url` to the `agent_services` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "x402"."agent_services" DROP COLUMN "service_url",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "url" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "agent_services_agent_id_url_key" ON "x402"."agent_services"("agent_id", "url");
