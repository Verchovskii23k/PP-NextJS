import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { daysOfWeek } from "@/db/schema";
import { eq } from "drizzle-orm";

export const daysOfWeekRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(daysOfWeek)),
  create: adminProcedure.input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(daysOfWeek).values(input).returning()),
  update: adminProcedure.input(z.object({ id: z.number(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, name } = input;
      return ctx.db.update(daysOfWeek).set({ name }).where(eq(daysOfWeek.id, id)).returning();
    }),
  delete: adminProcedure.input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(daysOfWeek).where(eq(daysOfWeek.id, input.id))),
});