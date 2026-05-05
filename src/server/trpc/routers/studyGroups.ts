import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { studyGroups } from "@/db/schema";
import { eq } from "drizzle-orm";

export const studyGroupsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(studyGroups);
  }),

  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(studyGroups)
        .where(eq(studyGroups.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  create: adminProcedure
    .input(z.object({
      code: z.string(),
      profileId: z.coerce.number().int(),
      course: z.coerce.number().int(),
      studentCount: z.coerce.number().int(),
      curatorId: z.coerce.number().int().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(studyGroups).values(input).returning();
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      code: z.string().min(1).optional(),
      profileId: z.coerce.number().int().optional(),
      course: z.coerce.number().int().optional(),
      studentCount: z.coerce.number().int().optional(),
      curatorId: z.coerce.number().int().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(studyGroups).set(data).where(eq(studyGroups.id, id)).returning();
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.delete(studyGroups).where(eq(studyGroups.id, input.id));
    }),
});