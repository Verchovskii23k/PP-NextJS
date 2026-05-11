import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { educationLevels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeDelete } from "@/lib/safeDelete";
export const educationLevelsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(educationLevels);
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(educationLevels).where(eq(educationLevels.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      abbreviation: z.string().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(educationLevels).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      abbreviation: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(educationLevels).set(data).where(eq(educationLevels.id, id)).returning();
    }),
delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(educationLevels, input.id)),
});