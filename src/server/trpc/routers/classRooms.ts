// src/server/trpc/routers/classrooms.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  classrooms, buildings, departments,
  lessons, units, unitRoots, studyGroups, unitTypes, disciplines,
} from "@/db/schema";
import { eq, sql, and, gte, isNull, or, SQL } from "drizzle-orm";  // добавлен SQL
import { safeDelete } from "@/lib/safeDelete";

export const classroomsRouter = router({
  list: adminProcedure
    .input(z.object({ lessonId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const baseQuery = ctx.db
        .select({
          id: classrooms.id,
          buildingId: classrooms.buildingId,
          roomNumber: classrooms.roomNumber,
          capacity: classrooms.capacity,
          departmentId: classrooms.departmentId,
          priorityLecture: classrooms.priorityLecture,
          priorityWorkshop: classrooms.priorityWorkshop,
          priorityGuidedStudy: classrooms.priorityGuidedStudy,
          priorityLab: classrooms.priorityLab,
          usageMetric: classrooms.usageMetric,
          isActive: classrooms.isActive,
          display: sql<string>`${buildings.number} || '-' || ${classrooms.roomNumber} || '-' || COALESCE(${departments.abbreviation}, 'Общая') || '-' || ${classrooms.usageMetric}`.as('display'),
        })
        .from(classrooms)
        .leftJoin(buildings, eq(classrooms.buildingId, buildings.id))
        .leftJoin(departments, eq(classrooms.departmentId, departments.id))
        // .where(eq(classrooms.isActive, true));

      if (input?.lessonId) {
        const [lesson] = await ctx.db
          .select({ unitId: lessons.unitId, disciplineId: lessons.disciplineId })
          .from(lessons)
          .where(eq(lessons.id, input.lessonId))
          .limit(1);
        if (!lesson) return [];

        // Вычисляем вместимость юнита
        let unitSize = 0;
        const [unit] = await ctx.db
          .select({ id: units.id, code: units.code, unitTypeId: units.unitTypeId })
          .from(units)
          .where(eq(units.id, lesson.unitId))
          .limit(1);
        if (unit) {
          const [unitType] = await ctx.db
            .select({ name: unitTypes.name, maxSize: unitTypes.maxSize })
            .from(unitTypes)
            .where(eq(unitTypes.id, unit.unitTypeId))
            .limit(1);
          if (unitType?.name === "ПОДГРУППА") {
            unitSize = unitType.maxSize ?? 16;
          } else {
            const roots = await ctx.db
              .select({ studyGroupId: unitRoots.studyGroupId })
              .from(unitRoots)
              .where(eq(unitRoots.unitCode, unit.code));
            if (roots.length > 0) {
              const groupIds = roots.map(r => r.studyGroupId);
              const groupsData = await ctx.db
                .select({ studentCount: studyGroups.studentCount })
                .from(studyGroups)
                .where(sql`${studyGroups.id} IN ${groupIds}`);
              unitSize = groupsData.reduce((sum, g) => sum + (g.studentCount ?? 0), 0);
            } else {
              unitSize = unitType?.maxSize ?? 0;
            }
          }
        }

        // Кафедра дисциплины
        const [disc] = await ctx.db
          .select({ departmentId: disciplines.departmentId })
          .from(disciplines)
          .where(eq(disciplines.id, lesson.disciplineId!))
          .limit(1);
        const deptId = disc?.departmentId ?? null;

        // Фильтрация
        const conditions: SQL<unknown>[] = [ gte(classrooms.capacity, unitSize) ];
        if (deptId !== null) {
          conditions.push(or(eq(classrooms.departmentId, deptId), isNull(classrooms.departmentId)) as SQL<unknown>);
        } else {
          conditions.push(isNull(classrooms.departmentId) as SQL<unknown>);
        }
        return baseQuery.where(and(...conditions));
      }

      return baseQuery;
    }),

  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: classrooms.id,
          buildingId: classrooms.buildingId,
          roomNumber: classrooms.roomNumber,
          capacity: classrooms.capacity,
          departmentId: classrooms.departmentId,
          priorityLecture: classrooms.priorityLecture,
          priorityWorkshop: classrooms.priorityWorkshop,
          priorityGuidedStudy: classrooms.priorityGuidedStudy,
          priorityLab: classrooms.priorityLab,
          usageMetric: classrooms.usageMetric,
          isActive: classrooms.isActive,
          display: sql<string>`${buildings.number} || '-' || ${classrooms.roomNumber} || '-' || COALESCE(${departments.abbreviation}, 'Общая') || '-' || ${classrooms.usageMetric}`.as('display'),
        })
        .from(classrooms)
        .leftJoin(buildings, eq(classrooms.buildingId, buildings.id))
        .leftJoin(departments, eq(classrooms.departmentId, departments.id))
        .where(eq(classrooms.id, input.id))
        .limit(1);
      return rows[0] ?? null;
    }),

  create: adminProcedure
    .input(z.object({
      buildingId: z.coerce.number().int(),
      roomNumber: z.string().min(1),
      capacity: z.coerce.number().int(),
      departmentId: z.coerce.number().int().optional(),
      priorityLecture: z.coerce.number().int().optional(),
      priorityWorkshop: z.coerce.number().int().optional(),
      priorityGuidedStudy: z.coerce.number().int().optional(),
      priorityLab: z.coerce.number().int().optional(),
      usageMetric: z.coerce.number().optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.insert(classrooms).values(input).returning()),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      buildingId: z.number().int().optional(),
      roomNumber: z.string().min(1).optional(),
      capacity: z.number().int().optional(),
      departmentId: z.number().int().nullable().optional(),
      priorityLecture: z.number().int().optional(),
      priorityWorkshop: z.number().int().optional(),
      priorityGuidedStudy: z.number().int().optional(),
      priorityLab: z.number().int().nullable().optional(),
      usageMetric: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.update(classrooms).set(data).where(eq(classrooms.id, id)).returning();
    }),

delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => safeDelete(classrooms, input.id)),
});