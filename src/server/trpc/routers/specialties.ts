import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { specialties } from "@/db/schema";
import { eq } from "drizzle-orm";

export const specialtiesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(specialties);
  }),
  create: adminProcedure
    .input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      departmentId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(specialties).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      code: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      departmentId: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(specialties).set(data).where(eq(specialties.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(specialties).where(eq(specialties.id, input.id));
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(specialties).where(eq(specialties.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});