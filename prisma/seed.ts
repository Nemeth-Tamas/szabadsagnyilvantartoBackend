import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const demoAdmin = await prisma.user.upsert({
    where: {
      email: "demoadmin@celldomolk.hivatal"
    },
    update: {},
    create: {
      email: "demoadmin@celldomolk.hivatal",
      name: "Demo Admin",
      password: "$2a$10$gdPlz7VzHM0ae0cHDVh/Xu.vCxuU/vG0OE8wrKKlbxnE8UJ63iL5e", // testpass
      role: "admin",
      maxDays: 30,
      remainingDays: 30,
      managerId: null
    }
  });

  const demoManager = await prisma.user.upsert({
    where: {
      email: "demomanager@celldomolk.hivatal"
    },
    update: {},
    create: {
      email: "demomanager@celldomolk.hivatal",
      name: "Demo Manager",
      password: "$2a$10$gdPlz7VzHM0ae0cHDVh/Xu.vCxuU/vG0OE8wrKKlbxnE8UJ63iL5e", // testpass
      role: "irodavezeto",
      maxDays: 30,
      remainingDays: 30,
      managerId: demoAdmin.id
    }
  });

  const demoUser = await prisma.user.upsert({
    where: {
      email: "demouser@celldomolk.hivatal"
    },
    update: {},
    create: {
      email: "demouser@celldomolk.hivatal",
      name: "Demo User",
      password: "$2a$10$gdPlz7VzHM0ae0cHDVh/Xu.vCxuU/vG0OE8wrKKlbxnE8UJ63iL5e", // testpass
      role: "felhasznalo",
      maxDays: 30,
      remainingDays: 30,
      managerId: demoManager.id
    }
  });

  const demoUserSzabadsag = await prisma.szabadsag.upsert({
    where: {
      id: "1"
    },
    update: {},
    create: {
      userId: demoUser.id,
      managerId: demoManager.id,
      type: "SZ",
      dates: [
        new Date("2025-01-01"),
        new Date("2025-01-02"),
        new Date("2025-01-03"),
        new Date("2025-01-04"),
        new Date("2025-01-05")
      ]
    }
  });

  const demoUserTappenz1 = await prisma.tappenz.upsert({
    where: {
      id: "1"
    },
    update: {},
    create: {
      userId: demoUser.id,
      managerId: demoManager.id,
      startDate: new Date("2025-01-10"),
      endDate: new Date("2025-01-15"),
    }
  });

  const demoUserTappenz2 = await prisma.tappenz.upsert({
    where: {
      id: "2"
    },
    update: {},
    create: {
      userId: demoUser.id,
      managerId: demoManager.id,
      startDate: new Date("2025-01-20"),
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });