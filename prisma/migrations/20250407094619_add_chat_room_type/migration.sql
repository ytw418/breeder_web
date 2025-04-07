-- DropIndex
DROP INDEX "Product_userId_idx";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "photos" DROP DEFAULT;
