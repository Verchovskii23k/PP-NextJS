import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { profiles, specialties, education, educationLevels, educationForms } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export const profilesRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: profiles.id,
        name: profiles.name,
        specialtyId: profiles.specialtyId,
        letterCode: profiles.letterCode,
        educationId: profiles.educationId,
        isActive: profiles.isActive,
        profileDisplay: sql<string>`CONCAT(${profiles.letterCode}, ' (', ${specialties.code}, ' - ', ${specialties.name}, ')')`.as('profile_display'),
        educationDisplay: sql<string>`${educationLevels.abbreviation} || ', ' || ${educationForms.abbreviation} || ' (' || ${education.durationMonths} || ' мес.)'`.as('education_display'),
      })
      .from(profiles)
      .innerJoin(specialties, eq(profiles.specialtyId, specialties.id))
      .leftJoin(education, eq(profiles.educationId, education.id))
      .leftJoin(educationLevels, eq(education.levelId, educationLevels.id))
      .leftJoin(educationForms, eq(education.formId, educationForms.id))
      .orderBy(asc(profiles.letterCode));
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: profiles.id,
          name: profiles.name,
          specialtyId: profiles.specialtyId,
          letterCode: profiles.letterCode,
          educationId: profiles.educationId,
          isActive: profiles.isActive,
          profileDisplay: sql<string>`CONCAT(${profiles.letterCode}, ' (', ${specialties.code}, ' - ', ${specialties.name}, ')')`.as('profile_display'),
          educationDisplay: sql<string>`${educationLevels.abbreviation} || ', ' || ${educationForms.abbreviation} || ' (' || ${education.durationMonths} || ' мес.)'`.as('education_display'),
        })
        .from(profiles)
        .innerJoin(specialties, eq(profiles.specialtyId, specialties.id))
        .leftJoin(education, eq(profiles.educationId, education.id))
        .leftJoin(educationLevels, eq(education.levelId, educationLevels.id))
        .leftJoin(educationForms, eq(education.formId, educationForms.id))
        .where(eq(profiles.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        specialtyId: z.coerce.number().int(),
        letterCode: z.string().min(1),   // стало обязательным (было optional)
        educationId: z.coerce.number().int().nullable().optional(),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const clean = {
          ...input,
          educationId: input.educationId ?? null,
        };
        return ctx.db.insert(profiles).values(clean).returning();
      }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      specialtyId: z.coerce.number().int().optional(),
      letterCode: z.string().optional(),
      educationId: z.coerce.number().int().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(profiles).set(data).where(eq(profiles.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(profiles).where(eq(profiles.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});