import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { unitRoots } from "@/db/schema";
import { eq } from "drizzle-orm";

export const unitRootsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(unitRoots)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(unitRoots).where(eq(unitRoots.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      unitCode: z.string().min(1),
      studyGroupId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(unitRoots).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      unitCode: z.string().min(1).optional(),
      studyGroupId: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(unitRoots).set(data).where(eq(unitRoots.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(unitRoots).where(eq(unitRoots.id, input.id))),
});