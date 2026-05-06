import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { studyGroups, profiles } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export const studyGroupsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: studyGroups.id,
        code: studyGroups.code,
        profileId: studyGroups.profileId,
        course: studyGroups.course,
        studentCount: studyGroups.studentCount,
        curatorId: studyGroups.curatorId,
        display: sql<string>`${studyGroups.code} || ' (' || ${profiles.letterCode} || '-' || ${profiles.name} || ')'`.as('display'),
      })
      .from(studyGroups)
      .innerJoin(profiles, eq(studyGroups.profileId, profiles.id))
      .orderBy(asc(studyGroups.code));
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: studyGroups.id,
          code: studyGroups.code,
          profileId: studyGroups.profileId,
          course: studyGroups.course,
          studentCount: studyGroups.studentCount,
          curatorId: studyGroups.curatorId,
          display: sql<string>`${studyGroups.code} || ' (' || ${profiles.letterCode} || '-' || ${profiles.name} || ')'`.as('display'),
        })
        .from(studyGroups)
        .innerJoin(profiles, eq(studyGroups.profileId, profiles.id))
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
      try {
        await ctx.db.delete(studyGroups).where(eq(studyGroups.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});