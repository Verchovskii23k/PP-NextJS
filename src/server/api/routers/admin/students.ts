// src/server/api/routers/admin/students.ts
import { router, adminProcedure } from "../../trpc";
import { z } from "zod";
import {
  students, profiles, specialties, departments, institutes, studyGroups,
} from "@/db/schema";
import { eq, like, sql, inArray } from "drizzle-orm";

export const studentRouter = router({
  getDetailed: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(15),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;

      const rows = await ctx.db
        .select({
          id: students.id,
          surname: students.surname,
          name: students.name,
          admissionYear: students.admissionYear,
          profileName: profiles.name,
          specialtyName: specialties.name,
          departmentName: departments.name,
          instituteName: institutes.name,
          groupCode: studyGroups.code,
          course: students.course,
          phone: students.phone,
          email: students.email,
          isInactive: students.isInactive,
        })
        .from(students)
        .leftJoin(profiles, eq(students.profileId, profiles.id))
        .leftJoin(specialties, eq(profiles.specialtyId, specialties.id))
        .leftJoin(departments, eq(specialties.departmentId, departments.id))
        .leftJoin(institutes, eq(departments.instituteId, institutes.id))
        .leftJoin(studyGroups, eq(students.studyGroupId, studyGroups.id))
        .where(input.search ? like(students.surname, `%${input.search}%`) : undefined)
        .limit(input.pageSize)
        .offset(offset)
        .orderBy(students.id);

      const [count] = await ctx.db.select({ cnt: sql<number>`count(*)` }).from(students);
      return { rows, total: count.cnt };
    }),

  create: adminProcedure
    .input(z.object({
      surname: z.string().min(1),
      name: z.string().min(1),
      admissionYear: z.number().int().min(2000).max(2100),
      profileId: z.number().int(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      isInactive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [newId] = await ctx.db.insert(students).values(input).returning({ id: students.id });
      return newId.id;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number().int(),
      data: z.object({
        surname: z.string().optional(),
        name: z.string().optional(),
        admissionYear: z.number().int().optional(),
        profileId: z.number().int().optional(),
        studyGroupId: z.number().int().nullable().optional(),
        course: z.number().int().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        isInactive: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(students).set(input.data).where(eq(students.id, input.id));
      return true;
    }),

  delete: adminProcedure
    .input(z.object({ ids: z.array(z.number().int()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(students).where(inArray(students.id, input.ids));
      return { deleted: input.ids.length };
    }),
});