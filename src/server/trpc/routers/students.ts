import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { students, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const studentsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: students.id,
        surname: students.surname,
        name: students.name,
        patronymic: students.patronymic,
        admissionYear: students.admissionYear,
        profileId: students.profileId,
        studyGroupId: students.studyGroupId,
        course: students.course,
        phone: students.phone,
        email: students.email,        // контактный email
        isActive: students.isActive,
        loginEmail: users.email,      // email-логин из users
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id));
  }),
  create: adminProcedure
    .input(z.object({
      surname: z.string().min(1),
      name: z.string().min(1),
      admissionYear: z.coerce.number().int(),
      profileId: z.coerce.number().int(),
      studyGroupId: z.coerce.number().int().nullable().optional(),
      course: z.coerce.number().int().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(students).values(input).returning();
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      surname: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      admissionYear: z.coerce.number().int().optional(),
      profileId: z.coerce.number().int().optional(),
      studyGroupId: z.coerce.number().int().nullable().optional(),
      course: z.coerce.number().int().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(students).set(data).where(eq(students.id, id)).returning();
    }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: students.id,
          surname: students.surname,
          name: students.name,
          patronymic: students.patronymic,
          admissionYear: students.admissionYear,
          profileId: students.profileId,
          studyGroupId: students.studyGroupId,
          course: students.course,
          phone: students.phone,
          email: students.email,
          isActive: students.isActive,
          loginEmail: users.email,
        })
        .from(students)
        .leftJoin(users, eq(students.userId, users.id))
        .where(eq(students.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [student] = await ctx.db
        .select({ userId: students.userId })
        .from(students)
        .where(eq(students.id, input.id))
        .limit(1);
      if (!student) throw new Error("Студент не найден");

      if (student.userId) {
        await ctx.db.delete(users).where(eq(users.id, student.userId));
      }

      await ctx.db.delete(students).where(eq(students.id, input.id));
      return { success: true };
    }),
});