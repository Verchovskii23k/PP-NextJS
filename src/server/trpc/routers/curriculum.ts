import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { curriculum, disciplines, curriculumProfiles } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export const curriculumRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: curriculum.id,
        course: curriculum.course,
        semester: curriculum.semester,
        disciplineId: curriculum.disciplineId,
        hoursLecture: curriculum.hoursLecture,
        hoursGuidedStudy: curriculum.hoursGuidedStudy,
        hoursWorkshop: curriculum.hoursWorkshop,
        hoursLab: curriculum.hoursLab,
        additionalTaskId: curriculum.additionalTaskId,
        controlTypeId: curriculum.controlTypeId,
        isActive: curriculum.isActive,
        display: sql<string>`${curriculum.course} || ' курс, ' || ${curriculum.semester} || ' сем. – ' || ${disciplines.abbreviation}`.as('display'),
      })
      .from(curriculum)
      .innerJoin(disciplines, eq(curriculum.disciplineId, disciplines.id))
      .orderBy(asc(curriculum.course), asc(curriculum.semester));
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: curriculum.id,
          course: curriculum.course,
          semester: curriculum.semester,
          disciplineId: curriculum.disciplineId,
          hoursLecture: curriculum.hoursLecture,
          hoursGuidedStudy: curriculum.hoursGuidedStudy,
          hoursWorkshop: curriculum.hoursWorkshop,
          hoursLab: curriculum.hoursLab,
          additionalTaskId: curriculum.additionalTaskId,
          controlTypeId: curriculum.controlTypeId,
          isActive: curriculum.isActive,
          display: sql<string>`${curriculum.course} || ' курс, ' || ${curriculum.semester} || ' сем. – ' || ${disciplines.abbreviation}`.as('display'),
        })
        .from(curriculum)
        .innerJoin(disciplines, eq(curriculum.disciplineId, disciplines.id))
        .where(eq(curriculum.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({
      course: z.coerce.number().int(),
      semester: z.coerce.number().int(),
      disciplineId: z.coerce.number().int(),
      hoursLecture: z.coerce.number().int().optional(),
      hoursGuidedStudy: z.coerce.number().int().optional(),
      hoursWorkshop: z.coerce.number().int().optional(),
      hoursLab: z.coerce.number().int().optional(),
      additionalTaskId: z.coerce.number().int().nullable().optional(),
      controlTypeId: z.coerce.number().int().nullable().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(curriculum).values(input).returning()),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      course: z.number().int().optional(),
      semester: z.number().int().optional(),
      disciplineId: z.number().int().optional(),
      hoursLecture: z.number().int().optional(),
      hoursGuidedStudy: z.number().int().optional(),
      hoursWorkshop: z.number().int().optional(),
      hoursLab: z.number().int().optional(),
      additionalTaskId: z.number().int().nullable().optional(),
      controlTypeId: z.number().int().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, isActive, ...data } = input;

      if (isActive === false) {
        await ctx.db.update(curriculumProfiles).set({ isActive: false }).where(eq(curriculumProfiles.curriculumId, id));
      }

      return ctx.db
        .update(curriculum)
        .set({ ...data, isActive })
        .where(eq(curriculum.id, id))
        .returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(curriculum).where(eq(curriculum.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});