-- AlterTable
ALTER TABLE "Major" ADD COLUMN     "career" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cert" TEXT,
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "longDesc" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "MajorGallery" (
    "id" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MajorGallery_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MajorGallery" ADD CONSTRAINT "MajorGallery_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE CASCADE ON UPDATE CASCADE;

