// src/server/trpc/routers/lessonClassrooms.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  lessonClassrooms, lessons, classrooms, buildings, departments,
  disciplines, lessonTypes, employeesDepartments, employees, units
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const lessonClassroomsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: lessonClassrooms.id,
        lessonId: lessonClassrooms.lessonId,
        classroomId: lessonClassrooms.classroomId,
        lessonDisplay: sql<string>`
          ${units.code} || '-' || ${lessonTypes.abbreviation} || '-' ||
          ${disciplines.abbreviation} || '-' ||
          ${employees.surname} || ' ' || left(${employees.name},1) || '.' ||
          left(${employees.patronymic},1) || '.'
        `.as('lessonDisplay'),
        classroomDisplay: sql<string>`
          ${buildings.number} || '-' || ${classrooms.roomNumber} || '-' ||
          COALESCE(${departments.abbreviation}, 'Общая') || '-' ||
          ${classrooms.usageMetric}
        `.as('classroomDisplay'),
      })
      .from(lessonClassrooms)
      .innerJoin(lessons, eq(lessonClassrooms.lessonId, lessons.id))
      .innerJoin(units, eq(lessons.unitId, units.id))
      .innerJoin(disciplines, eq(lessons.disciplineId, disciplines.id))
      .leftJoin(employeesDepartments, eq(lessons.teacherId, employeesDepartments.id))
      .leftJoin(employees, eq(employeesDepartments.employeeId, employees.id))
      .innerJoin(lessonTypes, eq(lessons.lessonTypeId, lessonTypes.id))
      .innerJoin(classrooms, eq(lessonClassrooms.classroomId, classrooms.id))
      .leftJoin(buildings, eq(classrooms.buildingId, buildings.id))
      .leftJoin(departments, eq(classrooms.departmentId, departments.id));
  }),
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: lessonClassrooms.id,
          lessonId: lessonClassrooms.lessonId,
          classroomId: lessonClassrooms.classroomId,
          lessonDisplay: sql<string>`
            ${units.code} || '-' || ${lessonTypes.abbreviation} || '-' ||
            ${disciplines.abbreviation} || '-' ||
            ${employees.surname} || ' ' || left(${employees.name},1) || '.' ||
            left(${employees.patronymic},1) || '.'
          `.as('lessonDisplay'),
          classroomDisplay: sql<string>`
            ${buildings.number} || '-' || ${classrooms.roomNumber} || '-' ||
            COALESCE(${departments.abbreviation}, 'Общая') || '-' ||
            ${classrooms.usageMetric}
          `.as('classroomDisplay'),
        })
        .from(lessonClassrooms)
        .innerJoin(lessons, eq(lessonClassrooms.lessonId, lessons.id))
        .innerJoin(units, eq(lessons.unitId, units.id))
        .innerJoin(disciplines, eq(lessons.disciplineId, disciplines.id))
        .leftJoin(employeesDepartments, eq(lessons.teacherId, employeesDepartments.id))
        .leftJoin(employees, eq(employeesDepartments.employeeId, employees.id))
        .innerJoin(lessonTypes, eq(lessons.lessonTypeId, lessonTypes.id))
        .innerJoin(classrooms, eq(lessonClassrooms.classroomId, classrooms.id))
        .leftJoin(buildings, eq(classrooms.buildingId, buildings.id))
        .leftJoin(departments, eq(classrooms.departmentId, departments.id))
        .where(eq(lessonClassrooms.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),
  create: adminProcedure
    .input(z.object({ lessonId: z.coerce.number().int(), classroomId: z.coerce.number().int() }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(lessonClassrooms).values(input).returning()),
  update: adminProcedure
    .input(z.object({ id: z.number(), lessonId: z.coerce.number().int().optional(), classroomId: z.coerce.number().int().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(lessonClassrooms).set(data).where(eq(lessonClassrooms.id, id)).returning();
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(lessonClassrooms).where(eq(lessonClassrooms.id, input.id));
        return { success: true };
      } catch (e: any) {
        if (e?.code === '23503' || e?.message?.includes('foreign key') || e?.cause?.code === '23503') {
          throw new Error('Невозможно удалить – запись используется в других таблицах');
        }
        throw e;
      }
    }),
});