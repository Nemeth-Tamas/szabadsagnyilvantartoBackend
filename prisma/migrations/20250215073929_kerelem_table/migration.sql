-- CreateTable
CREATE TABLE "Kerelem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dates" TIMESTAMP(3)[],
    "managerId" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectedMessage" TEXT,
    "szabadsagId" TEXT,
    "submittingName" TEXT NOT NULL,
    "submittingEmailIdentifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kerelem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Kerelem" ADD CONSTRAINT "Kerelem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kerelem" ADD CONSTRAINT "Kerelem_szabadsagId_fkey" FOREIGN KEY ("szabadsagId") REFERENCES "Szabadsag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
