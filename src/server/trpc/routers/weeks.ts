import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { weeks } from "@/db/schema";
import { eq } from "drizzle-orm";

export const weeksRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(weeks)),
  create: adminProcedure.input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(weeks).values(input).returning()),
  update: adminProcedure.input(z.object({ id: z.number(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, name } = input;
      return ctx.db.update(weeks).set({ name }).where(eq(weeks.id, id)).returning();
    }),
  delete: adminProcedure.input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(weeks).where(eq(weeks.id, input.id))),
});