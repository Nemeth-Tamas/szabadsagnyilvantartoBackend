import { User } from "@prisma/client";
import { isOnLeave } from "./users";
import { sendMail } from "./mail";

export const checkManagerAndSendEmail = async (manager: User, user: User, dates: Date[]): Promise<void> => {
  let managersLeaves = await prisma.szabadsag.findMany({
    where: {
      userId: manager.id
    }
  });

  let managerOnLeaveToday = await isOnLeave(managersLeaves);

  let datesWithoutTime = dates.map((date) => {
    let d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  if (managerOnLeaveToday) {
    let subject = "Kérelem érkezett";
    let text = `${user.name} a következő időpontokra kért szabadságot: ${datesWithoutTime.join(", ")}.\n\nKérem, hogy a kérelmet mielőbb vizsgálja át.`
    sendMail(subject, text);
  }
};