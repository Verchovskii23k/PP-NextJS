import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { buildings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const buildingsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(buildings);
  }),
  create: adminProcedure
    .input(z.object({ number: z.coerce.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(buildings).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      number: z.coerce.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(buildings).set(data).where(eq(buildings.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(buildings).where(eq(buildings.id, input.id));
    }),
  get: adminProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db.select().from(buildings).where(eq(buildings.id, input.id)).limit(1);
    return rows[0] ?? null;
  }),
});