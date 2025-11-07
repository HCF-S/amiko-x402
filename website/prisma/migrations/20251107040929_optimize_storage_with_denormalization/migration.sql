/*
  Warnings:

  - You are about to drop the column `payment_amount` on the `feedback_records` table. All the data in the column will be lost.
  - You are about to drop the column `proof_of_payment` on the `feedback_records` table. All the data in the column will be lost.
  - You are about to drop the column `payment_tx` on the `job_records` table. All the data in the column will be lost.
  - You are about to alter the column `payment_amount` on the `job_records` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,0)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "x402"."agents" ADD COLUMN     "feedback_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "job_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "x402"."feedback_records" DROP COLUMN "payment_amount",
DROP COLUMN "proof_of_payment";

-- AlterTable
ALTER TABLE "x402"."job_records" DROP COLUMN "payment_tx",
ALTER COLUMN "payment_amount" SET DATA TYPE INTEGER;
