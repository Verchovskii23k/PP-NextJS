import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { pairs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const pairsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(pairs)),
  create: adminProcedure
  .input(z.object({ number: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => ctx.db.insert(pairs).values(input).returning()),

update: adminProcedure
  .input(z.object({ id: z.number(), number: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    const { id, number } = input;
    return ctx.db.update(pairs).set({ number }).where(eq(pairs.id, id)).returning();
  }),
  delete: adminProcedure.input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(pairs).where(eq(pairs.id, input.id))),
});