import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { weeks } from "@/db/schema";
import { eq } from "drizzle-orm";

export const weeksRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(weeks)),
  create: adminProcedure
  .input(z.object({ type: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => ctx.db.insert(weeks).values(input).returning()),

update: adminProcedure
  .input(z.object({ id: z.number(), type: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const { id, type } = input;
    return ctx.db.update(weeks).set({ type }).where(eq(weeks.id, id)).returning();
  }),
  delete: adminProcedure.input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(weeks).where(eq(weeks.id, input.id))),
});