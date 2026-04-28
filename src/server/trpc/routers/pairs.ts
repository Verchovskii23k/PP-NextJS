import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { pairs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const pairsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(pairs)),
  create: adminProcedure.input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(pairs).values(input).returning()),
  update: adminProcedure.input(z.object({ id: z.number(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, name } = input;
      return ctx.db.update(pairs).set({ name }).where(eq(pairs.id, id)).returning();
    }),
  delete: adminProcedure.input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(pairs).where(eq(pairs.id, input.id))),
});