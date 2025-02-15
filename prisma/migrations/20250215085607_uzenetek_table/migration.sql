-- CreateTable
CREATE TABLE "Uzenetek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sendingName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Uzenetek_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Uzenetek" ADD CONSTRAINT "Uzenetek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
