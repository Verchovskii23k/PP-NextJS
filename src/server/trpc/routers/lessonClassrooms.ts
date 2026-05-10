// src/server/trpc/routers/lessonClassrooms.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  lessonClassrooms, lessons, classrooms, buildings, departments,
  disciplines, lessonTypes, employeesDepartments, employees, units,
  scheduleDisplay
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// Функция пересчёта displayText для всех слотов урока
async function syncScheduleDisplayForLesson(db: any, lessonId: number) {
  // Находим все отображаемые слоты этого урока
  const rows = await db
    .select({
      id: scheduleDisplay.id,
      lessonId: scheduleDisplay.lessonId,
      unitCode: scheduleDisplay.unitCode,
      disciplineAbbr: disciplines.abbreviation,
      lessonTypeName: lessonTypes.name,
      teacherSurname: employees.surname,
      teacherName: employees.name,
      teacherPatronymic: employees.patronymic,
      buildingNumber: buildings.number,
      roomNumber: classrooms.roomNumber,
    })
    .from(scheduleDisplay)
    .innerJoin(lessons, eq(scheduleDisplay.lessonId, lessons.id))
    .innerJoin(disciplines, eq(lessons.disciplineId, disciplines.id))
    .innerJoin(lessonTypes, eq(lessons.lessonTypeId, lessonTypes.id))
    .leftJoin(employeesDepartments, eq(lessons.teacherId, employeesDepartments.id))
    .leftJoin(employees, eq(employeesDepartments.employeeId, employees.id))
    .leftJoin(lessonClassrooms, eq(scheduleDisplay.lessonId, lessonClassrooms.lessonId))
    .leftJoin(classrooms, eq(lessonClassrooms.classroomId, classrooms.id))
    .leftJoin(buildings, eq(classrooms.buildingId, buildings.id))
    .where(eq(scheduleDisplay.lessonId, lessonId));

  // Пересчитываем displayText для каждой найденной строки
  for (const row of rows) {
    const typeMap: Record<string, string> = {
      lecture: 'лек.',
      lab: 'лаб.',
      workshop: 'пр.',
      guidedStudy: 'кср.'
    };
    const typeAbbr = typeMap[row.lessonTypeName] || row.lessonTypeName;
    const disc = row.disciplineAbbr;
    const teacher = `${row.teacherSurname} ${row.teacherName?.[0] ?? ''}.${row.teacherPatronymic?.[0] ? row.teacherPatronymic[0] + '.' : ''}`;
    const room = row.buildingNumber ? `${row.buildingNumber}-${row.roomNumber}` : 'б/а';
    const text = `[${row.unitCode}] ${typeAbbr}${disc} – ${teacher}, ${room}`;

    await db
      .update(scheduleDisplay)
      .set({ displayText: text })
      .where(eq(scheduleDisplay.id, row.id));
  }
}

export const lessonClassroomsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: lessonClassrooms.id,
        lessonId: lessonClassrooms.lessonId,
        classroomId: lessonClassrooms.classroomId,
        lessonDisplay: sql<string>`${units.code} || '-' || ${lessonTypes.abbreviation} || '-' || ${disciplines.abbreviation} || '-' || ${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'  `.as('lessonDisplay'),
        classroomDisplay: sql<string>` ${buildings.number} || '-' || ${classrooms.roomNumber} || '-' || COALESCE(${departments.abbreviation}, 'Общая') || '-' || ${classrooms.usageMetric} `.as('classroomDisplay'),
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
          lessonDisplay: sql<string>`${units.code} || '-' || ${lessonTypes.abbreviation} || '-' || ${disciplines.abbreviation} || '-' || ${employees.surname} || ' ' || left(${employees.name},1) || '.' || left(${employees.patronymic},1) || '.'  `.as('lessonDisplay'),
          classroomDisplay: sql<string>` ${buildings.number} || '-' || ${classrooms.roomNumber} || '-' || COALESCE(${departments.abbreviation}, 'Общая') || '-' || ${classrooms.usageMetric} `.as('classroomDisplay'),
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
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(lessonClassrooms).values(input).returning();
      // Синхронизируем расписание
      await syncScheduleDisplayForLesson(ctx.db, input.lessonId);
      return { success: true };
    }),

  update: adminProcedure
    .input(z.object({ id: z.number(), lessonId: z.coerce.number().int().optional(), classroomId: z.coerce.number().int().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(lessonClassrooms).set(data).where(eq(lessonClassrooms.id, id)).returning();
      // Получаем lessonId, чтобы синхронизировать (если он не был передан явно, ищем по id)
      let lessonId = data.lessonId;
      if (!lessonId) {
        const [existing] = await ctx.db.select({ lessonId: lessonClassrooms.lessonId }).from(lessonClassrooms).where(eq(lessonClassrooms.id, id)).limit(1);
        if (existing) lessonId = existing.lessonId;
      }
      if (lessonId) {
        await syncScheduleDisplayForLesson(ctx.db, lessonId);
      }
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Получаем lessonId перед удалением
      const [existing] = await ctx.db.select({ lessonId: lessonClassrooms.lessonId }).from(lessonClassrooms).where(eq(lessonClassrooms.id, input.id)).limit(1);
      if (existing) {
        await ctx.db.delete(lessonClassrooms).where(eq(lessonClassrooms.id, input.id));
        // После удаления аудитории синхронизируем расписание (аудитория станет "б/а")
        await syncScheduleDisplayForLesson(ctx.db, existing.lessonId);
      }
      return { success: true };
    }),
});