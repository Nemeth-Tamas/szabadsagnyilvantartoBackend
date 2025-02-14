import { Szabadsag, User } from "@prisma/client";

const isOnLeave = async (szabadsagok: Szabadsag[]): Promise<boolean> => {
  if (!szabadsagok.length) return false;
  let today = new Date();
  today.setHours(0, 0, 0, 0);

  return szabadsagok.some((szabadsag) => {
    szabadsag.dates.includes(today);
  });
};

export const checkStatus = async (user: User): Promise<User> => {
  // Check tappenz
  // set sick
  let szabadsagok = await prisma.szabadsag.findMany({
    where: {
      userId: user.id
    }
  })
  user.onLeave = await isOnLeave(szabadsagok);
  return user;
};