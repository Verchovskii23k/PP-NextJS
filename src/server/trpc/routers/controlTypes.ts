import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { controlTypes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const controlTypesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(controlTypes)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(controlTypes).where(eq(controlTypes.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({ name: z.string().min(1), abbreviation: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(controlTypes).values(input).returning()),
  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), abbreviation: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(controlTypes).set(data).where(eq(controlTypes.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(controlTypes).where(eq(controlTypes.id, input.id))),
});