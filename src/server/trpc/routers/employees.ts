
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
      phone: z.string().optional(),
      email: z.string().email().optional(),
      isInactive: z.boolean().default(false),
      // authentication_id пока не создаём, позже через генерацию логинов
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
      phone: z.string().optional(),
      email: z.string().email().optional(),
      isInactive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(employees).set(data).where(eq(employees.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(employees).where(eq(employees.id, input.id));
    }),
});