-- 프로필 앨범(사용자가 만든 하이라이트). relationMode = "prisma" 라 FK 는 두지 않는다.
CREATE TABLE "ProfileAlbum" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "postIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "ProfileAlbum_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileAlbum_userId_createdAt_idx" ON "ProfileAlbum"("userId", "createdAt");
