import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { curriculumProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const curriculumProfilesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => ctx.db.select().from(curriculumProfiles)),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(curriculumProfiles).where(eq(curriculumProfiles.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      curriculumId: z.coerce.number().int(),
      profileId: z.coerce.number().int(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(curriculumProfiles).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      curriculumId: z.coerce.number().int().optional(),
      profileId: z.coerce.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(curriculumProfiles).set(data).where(eq(curriculumProfiles.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => ctx.db.delete(curriculumProfiles).where(eq(curriculumProfiles.id, input.id))),
});