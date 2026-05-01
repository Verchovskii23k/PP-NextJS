import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { units } from "@/db/schema";
import { eq } from "drizzle-orm";

export const unitsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(units);
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(units).where(eq(units.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      code: z.string().min(1),
      unitTypeId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(units).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      code: z.string().min(1).optional(),
      unitTypeId: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(units).set(data).where(eq(units.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(units).where(eq(units.id, input.id));
    }),
});