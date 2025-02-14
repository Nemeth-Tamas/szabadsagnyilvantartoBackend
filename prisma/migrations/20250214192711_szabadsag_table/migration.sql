-- CreateTable
CREATE TABLE "Szabadsag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dates" TIMESTAMP(3)[],
    "managerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Szabadsag_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Szabadsag" ADD CONSTRAINT "Szabadsag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
