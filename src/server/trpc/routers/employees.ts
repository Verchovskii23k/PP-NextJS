
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { employees } from "@/db/schema";
import { eq } from "drizzle-orm";

export const employeesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(employees);
  }),
  create: adminProcedure
  .input(z.object({
    surname: z.string().min(1),
    name: z.string().min(1),
    patronymic: z.string().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    isActive: z.boolean().default(true),         // ← новое поле
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert(employees).values(input).returning();
  }),

update: adminProcedure
  .input(z.object({
    id: z.number(),
    surname: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    patronymic: z.string().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    isActive: z.boolean().optional(),           // ← новое поле
  }))
  .mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.db.update(employees).set(data).where(eq(employees.id, id)).returning();
  }),
});