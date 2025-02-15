import express from 'express';
import { Request, Response } from 'express';
import prisma from '@/lib/db';
import { authenticateToken, authorizeRole } from '@/lib/middleware';
import { resetPlanById } from '@/utils/plan';
import * as xlsx from 'xlsx';

const router = express.Router();

router.get("/plans/:userId", authenticateToken, async (req: Request, res: Response): Promise<any> => {
  let reqUser = req.user;

  if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

  let { userId } = req.params;

  try {
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
      if (!user) return res.status(404).json({ error: 'User not found' });
      try {
        let newPlan = await prisma.plan.create({
          data: {
            userId: user.id,
            managerId: user.managerId || user.id,
            dates: [],
            filledOut: false
          }
        });
        plan = newPlan;
      } catch (error: any) {
        if (error.code === 'P2002') { // Unique constraint fail because react double calls
          plan = await prisma.plan.findFirst({
            where: {
              userId: userId
            }
          });
        } else {
          throw error;
        }
      }
    }

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    if (reqUser.role === 'felhasznalo' || reqUser.role === 'irodavezeto' || reqUser.role === 'jegyzo') {
      if (plan.userId !== reqUser.id) return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(plan);
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get("/plans/:userId/excel", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  let { userId } = req.params;

  try {
    let user = await prisma.user.findUnique({
      where: {
        id: userId
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

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
      if (!user) return res.status(404).json({ error: 'User not found' });
      let newPlan = await prisma.plan.create({
        data: {
          userId: user.id,
          managerId: user.managerId || user.id,
          dates: [],
          filledOut: false
        }
      });
      plan = newPlan;
    }

    let workbook = xlsx.utils.book_new();
    let worksheet = xlsx.utils.aoa_to_sheet([])

    xlsx.utils.sheet_add_aoa(worksheet, [[user.name]], {origin: 'A1'});
    xlsx.utils.sheet_add_aoa(worksheet, [["Január", "Február", "Március", "Április", "Május", "Junius", "Julius", "Augusztus", "Szeptember", "Október", "November", "December"]], {origin: 'A2'});

    let months: Date[][] = [];
    for (const element of plan.dates) {
      let date = new Date(element);
      let month = date.getMonth();
      if (months[month] == undefined) {
        months[month] = [];
      }
      months[month].push(date);
    }

    let row = 3;

    for (let month = 0; month < months.length; month++) {
      if (months[month] == undefined) {
        continue;
      }

      let dates = months[month];

      dates.sort((a, b) => a.getDate() - b.getDate());

      for (let i = 0; i < dates.length; i++) {
        let currentDate = dates[i];
        let nextDate = dates[i + 1];

        let cellAddress = xlsx.utils.encode_cell({ r: row - 1, c: month });
        xlsx.utils.sheet_add_aoa(worksheet, [[currentDate.getDate()]], {origin: cellAddress});

        row++;

        if (nextDate && (nextDate.getDate() - currentDate.getDate() > 1)) {
          row ++;
        }
      }

      row = 3;
    }

    xlsx.utils.book_append_sheet(workbook, worksheet, 'Szabadság terv');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + user.name + '_szabadsag.xlsx');
    res.end(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete("/plans/all", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  try {
    let users = await prisma.user.findMany();
    for (const user of users) {
      let uid = user.id;
      resetPlanById(uid);
    }
    return res.status(200).json({ message: 'All plans reset' });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete("/plans/:userId", authenticateToken, authorizeRole('admin'), async (req: Request, res: Response): Promise<any> => {
  let { userId } = req.params;

  try {
    let plan = await resetPlanById(userId);
    return res.json(plan);
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;