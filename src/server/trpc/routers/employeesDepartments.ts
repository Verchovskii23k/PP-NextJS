import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { employeesDepartments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const employeesDepartmentsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(employeesDepartments)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(employeesDepartments).where(eq(employeesDepartments.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      employeeId: z.number().int(),
      departmentId: z.number().int(),
      employmentType: z.string().optional(),
      position: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(employeesDepartments).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      employeeId: z.number().int().optional(),
      departmentId: z.number().int().optional(),
      employmentType: z.string().optional(),
      position: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(employeesDepartments).set(data).where(eq(employeesDepartments.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(employeesDepartments).where(eq(employeesDepartments.id, input.id))),
});