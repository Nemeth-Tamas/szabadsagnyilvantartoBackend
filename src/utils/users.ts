import { Szabadsag, Tappenz, User } from "@prisma/client";

const isOnLeave = async (szabadsagok: Szabadsag[]): Promise<boolean> => {
  if (!szabadsagok.length) return false;
  let today = new Date();
  today.setHours(0, 0, 0, 0);

  return szabadsagok.some((szabadsag) => {
    szabadsag.dates.includes(today);
  });
};

const isSick = (tappenz: Tappenz): boolean => {
  if (!tappenz) return false;
  
  let today = new Date();
  today.setHours(0, 0, 0, 0);

  if ((tappenz.endDate == null || today < tappenz.endDate) && today >= tappenz.startDate) {
    return true;
  } else {
    return false;
  }
};

export const checkStatus = async (user: User): Promise<User> => {
  let latestTappenz = await prisma.tappenz.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      startDate: 'desc'
    }
  });
  if (!latestTappenz) {
    user.sick = false;
  } else {
    user.sick = isSick(latestTappenz);
  }
  let szabadsagok = await prisma.szabadsag.findMany({
    where: {
      userId: user.id
    }
  })
  user.onLeave = await isOnLeave(szabadsagok);
  return user;
};