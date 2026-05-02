import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { departments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const departmentsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(departments);
  }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      abbreviation: z.string().optional(),
      instituteId: z.number().int(),
      departmentCode: z.number().int().positive(),
      headId: z.number().int().optional(), // пока может быть пустым
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(departments).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      abbreviation: z.string().optional(),
      instituteId: z.number().int().optional(),
      departmentCode: z.number().int().positive().optional(),
      headId: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(departments).set(data).where(eq(departments.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(departments).where(eq(departments.id, input.id));
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(departments).where(eq(departments.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});