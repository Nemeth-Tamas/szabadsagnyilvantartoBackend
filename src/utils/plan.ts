import prisma from "@/lib/db";
import { Plan } from "@prisma/client";

export const resetPlanById = async (userId: string): Promise<Plan | Error> => {
  let plan = await prisma.plan.findFirst({
    where: {
      userId: userId
    }
  });

  if (!plan) {
    let user = await prisma.user.findUnique({
      where: {
        id: userId
      }
    });
    if (!user) return new Error('User not found');
    let newPlan = await prisma.plan.create({
      data: {
        userId: user.id,
        managerId: user.managerId || user.id,
        dates: [],
        filledOut: false
      }
    });
    return newPlan;
  }

  let planId = plan.id;
  let planDoc = await prisma.plan.update({
    where: {
      id: planId
    },
    data: {
      dates: [],
      filledOut: false
    }
  });

  return planDoc;
};