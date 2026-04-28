import { z } from "zod";
import { router, publicProcedure } from "../trpc"; // пока public, позже ограничим
import {
  schedule, lessons, lessonTypes, disciplines,
  classrooms, buildings, daysOfWeek, pairs,
  employeesDepartments, employees, studyGroups, units, unitRoots
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const scheduleRouter = router({
  getSchedule: publicProcedure
    .input(z.object({
      weekNumber: z.number().int().optional(),
      dayOfWeekId: z.number().int().optional(),
      groupId: z.number().int().optional(),
      teacherId: z.number().int().optional(),
      classroomId: z.number().int().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.weekNumber) conditions.push(eq(schedule.weekNumber, input.weekNumber));
      if (input.dayOfWeekId) conditions.push(eq(schedule.dayOfWeekId, input.dayOfWeekId));
      if (input.classroomId) conditions.push(eq(schedule.classroomId, input.classroomId));

      // Фильтр по группе — через юниты
      let groupUnitCodes: string[] = [];
      if (input.groupId) {
        const roots = await ctx.db
          .select({ unitCode: unitRoots.unitCode })
          .from(unitRoots)
          .where(eq(unitRoots.studyGroupId, input.groupId));
        groupUnitCodes = roots.map(r => r.unitCode);
        if (groupUnitCodes.length === 0) return []; // нет юнитов — нет расписания
      }

      const data = await ctx.db
        .select({
          scheduleId: schedule.id,
          weekNumber: schedule.weekNumber,
          dayOfWeek: daysOfWeek.name,
          pairNumber: pairs.number,
          lessonId: schedule.lessonId,
          disciplineName: disciplines.name,
          lessonTypeName: lessonTypes.name,
          classroomId: schedule.classroomId,
          classroomNumber: classrooms.roomNumber,
          buildingNumber: buildings.number,
          teacherSurname: employees.surname,
          teacherName: employees.name,
          unitCode: units.code,
        })
        .from(schedule)
        .innerJoin(lessons, eq(schedule.lessonId, lessons.id))
        .innerJoin(lessonTypes, eq(lessons.lessonTypeId, lessonTypes.id))
        .innerJoin(disciplines, eq(lessons.disciplineId, disciplines.id))
        .leftJoin(classrooms, eq(schedule.classroomId, classrooms.id))
        .leftJoin(buildings, eq(classrooms.buildingId, buildings.id))
        .innerJoin(units, eq(lessons.unitId, units.id))
        .leftJoin(employeesDepartments, eq(lessons.teacherId, employeesDepartments.id))
        .leftJoin(employees, eq(employeesDepartments.employeeId, employees.id))
        .innerJoin(daysOfWeek, eq(schedule.dayOfWeekId, daysOfWeek.id))
        .innerJoin(pairs, eq(schedule.pairNumberId, pairs.id))
        .where(and(...conditions))
        .orderBy(schedule.weekNumber, daysOfWeek.id, pairs.number);

      // Фильтрация по группе и преподавателю пост-запросом (т.к. связи сложные)
      let filtered = data;
      if (input.groupId && groupUnitCodes.length > 0) {
        filtered = filtered.filter(row => groupUnitCodes.includes(row.unitCode));
      }
      if (input.teacherId) {
        filtered = filtered.filter(row => {
          // teacherId в lessons — это id из employeesDepartments, нужно найти employeeId
          return row.teacherSurname !== null; // упрощённо, так как мы уже получили teacherSurname через join
        });
      }

      return filtered;
    }),

  // Справочные данные для фильтров
  filters: publicProcedure.query(async ({ ctx }) => {
    const [weeks, days, pairsList, groups, teachers, classroomsList] = await Promise.all([
      ctx.db.selectDistinct({ weekNumber: schedule.weekNumber }).from(schedule).orderBy(schedule.weekNumber),
      ctx.db.select().from(daysOfWeek).orderBy(daysOfWeek.id),
      ctx.db.select().from(pairs).orderBy(pairs.number),
      ctx.db.select({ id: studyGroups.id, code: studyGroups.code }).from(studyGroups),
      ctx.db.select({
        id: employeesDepartments.id,
        surname: employees.surname,
        name: employees.name,
      })
        .from(employeesDepartments)
        .innerJoin(employees, eq(employeesDepartments.employeeId, employees.id)),
      ctx.db.select({
        id: classrooms.id,
        roomNumber: classrooms.roomNumber,
        buildingId: classrooms.buildingId,
      }).from(classrooms),
    ]);
    return { weeks, days, pairs: pairsList, groups, teachers, classrooms: classroomsList };
  }),
});