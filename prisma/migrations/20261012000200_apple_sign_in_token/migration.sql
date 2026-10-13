-- CreateTable
CREATE TABLE "AppleSignInToken" (
    "snsId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppleSignInToken_pkey" PRIMARY KEY ("snsId")
);
