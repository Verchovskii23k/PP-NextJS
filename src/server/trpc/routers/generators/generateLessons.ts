// src/server/api/routers/generateLessons.ts
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import {
  curriculum,
  curriculumProfiles,
  studyGroups,
  units,
  unitTypes,
  unitRoots,
  hourTypeMapping,
  disciplineTeachers,
  lessons,
  lessonTypes,
  lessonClassrooms,
  schedule,
  profiles,
  disciplines,
  settings
} from "@/db/schema";
import { eq, and, inArray, sql, or, gt } from "drizzle-orm";

export const generateLessonsRouter = router({
  generateLessons: adminProcedure
    .input(z.object({
      currentSemester: z.coerce.number().int().optional()
    }).optional())
    .mutation(async ({ ctx, input }) => {
      // 1. Очистка зависимых таблиц
      await ctx.db.transaction(async (tx) => {
        await tx.delete(schedule);
        await tx.delete(lessonClassrooms);
        await tx.delete(lessons);
      });

      // 2. Соответствие "план_час_колонка" → (lesson_type_id, поле приоритета в unitTypes)
      const mappings = await ctx.db
        .select()
        .from(hourTypeMapping)
        .where(eq(hourTypeMapping.isActive, true));
      const hourTypeMap = new Map<string, { lessonTypeId: number; priorityCol: string }>();
      for (const m of mappings) {
        hourTypeMap.set(m.planHourColumn, {
          lessonTypeId: m.lessonTypeId,
          priorityCol: m.priorityColumn,
        });
      }

      // Карта для перевода CamelCase приоритета в snake_case столбца
      const priorityColumnSnake: Record<string, string> = {
        priorityLecture: "priority_lecture",
        priorityWorkshop: "priority_workshop",
        priorityGuidedStudy: "priority_guided_study",
        priorityLab: "priority_lab",
      };
      const [semesterSetting] = await ctx.db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, "current_semester"))
        .limit(1);
      const currentSemester = semesterSetting ? Number(semesterSetting.value) : 1;   // Число!

      // 3. Все учебные планы с фильтром по семестру
      const plans = await ctx.db
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
        })
        .from(curriculum)
        .innerJoin(disciplines, eq(curriculum.disciplineId, disciplines.id))
        .where(
          and(
            eq(curriculum.isActive, true),
            eq(disciplines.isActive, true),
            eq(curriculum.semester, currentSemester),
            or(
              gt(curriculum.hoursGuidedStudy, 0),
              gt(curriculum.hoursLecture, 0),
              gt(curriculum.hoursLab, 0),
              gt(curriculum.hoursWorkshop, 0),
            )
          )
        );
      // 4. Обработка планов
      const problems: Record<string, number> = {};
      const lessonsToInsert: {
        curriculumId: number;
        disciplineId: number;
        lessonTypeId: number;
        unitId: number;
        countPerSemester: number;
      }[] = [];

      for (const plan of plans) {
        const { id: planId, disciplineId, course } = plan;

        const hourFields = [
          { field: plan.hoursLecture, mapKey: "hours_lecture" },
          { field: plan.hoursGuidedStudy, mapKey: "hours_guided_study" },
          { field: plan.hoursWorkshop, mapKey: "hours_workshop" },
          { field: plan.hoursLab, mapKey: "hours_lab" },
        ];

        for (const { field, mapKey } of hourFields) {
          if (!field || field <= 0) continue;

          const mapping = hourTypeMap.get(mapKey);
          if (!mapping) {
            problems.no_hour_type_mapping = (problems.no_hour_type_mapping || 0) + 1;
            continue;
          }
          const { lessonTypeId, priorityCol } = mapping;

          const countPerSemester = Math.ceil(field / 2);

          // Профили, связанные с этим планом
          const profileRows = await ctx.db
            .select({ profileId: curriculumProfiles.profileId })
            .from(curriculumProfiles)
            .innerJoin(profiles, eq(curriculumProfiles.profileId, profiles.id))
            .where(
              and(
                eq(curriculumProfiles.curriculumId, planId),
                eq(curriculumProfiles.isActive, true),
                eq(profiles.isActive, true)
              )
            );
          const profileIds = profileRows.map(r => r.profileId);
          if (profileIds.length === 0) {
            problems.no_profiles = (problems.no_profiles || 0) + 1;
            continue;
          }

          // Группы нужного курса для этих профилей
          const groups = await ctx.db
            .select({ id: studyGroups.id })
            .from(studyGroups)
            .where(
              and(
                inArray(studyGroups.profileId, profileIds),
                eq(studyGroups.course, course)
              )
            );
          const groupIds = groups.map(g => g.id);
          if (groupIds.length === 0) {
            problems.no_groups = (problems.no_groups || 0) + 1;
            continue;
          }

          // Получаем приоритет для этого типа занятия
          const snakeCol = priorityColumnSnake[priorityCol];
          if (!snakeCol) {
            problems.unknown_priority_column = (problems.unknown_priority_column || 0) + 1;
            continue;
          }
          const prioritySql = sql<number>`COALESCE(${sql.identifier(snakeCol)}, 0)`;

          // Все юниты, связанные с найденными группами
          const unitRows = await ctx.db
            .select({
              id: units.id,
              priority: prioritySql,
            })
            .from(units)
            .innerJoin(unitRoots, eq(units.code, unitRoots.unitCode))
            .innerJoin(unitTypes, eq(units.unitTypeId, unitTypes.id))
            .where(
              and(
                inArray(unitRoots.studyGroupId, groupIds),
                eq(unitTypes.isActive, true)
              )
            );

          if (unitRows.length === 0) {
            problems.no_units = (problems.no_units || 0) + 1;
            continue;
          }

          // Фильтр по приоритетам
          const priority1 = unitRows.filter(u => u.priority === 1);
          const priority2 = unitRows.filter(u => u.priority === 2);
          let unitsToUse: typeof unitRows;
          if (priority1.length > 0) {
            unitsToUse = priority1;
          } else if (priority2.length > 0) {
            unitsToUse = priority2;
          } else {
            problems.no_valid_priority = (problems.no_valid_priority || 0) + 1;
            continue;
          }

          for (const unit of unitsToUse) {
            lessonsToInsert.push({
              curriculumId: planId,
              disciplineId,
              lessonTypeId,
              unitId: unit.id,
              countPerSemester,
            });
          }
        }
      }

      // 5. Вставка занятий
      if (lessonsToInsert.length > 0) {
        await ctx.db.insert(lessons).values(lessonsToInsert);
      }

      // 6. Назначение преподавателей
      const lessonsWithoutTeacher = await ctx.db
        .select({
          id: lessons.id,
          disciplineId: lessons.disciplineId,
          lessonTypeId: lessons.lessonTypeId,
        })
        .from(lessons)
        .where(sql`${lessons.teacherId} IS NULL`);

      const teacherLoad = new Map<number, number>();

      for (const l of lessonsWithoutTeacher) {
        const teachers = await ctx.db
          .select({ teacherDeptId: disciplineTeachers.teacherDepartmentId })
          .from(disciplineTeachers)
          .where(
            and(
              eq(disciplineTeachers.disciplineId, l.disciplineId),
              eq(disciplineTeachers.lessonTypeId, l.lessonTypeId),
              eq(disciplineTeachers.isActive, true)
            )
          );

        if (teachers.length === 0) {
          problems.no_teacher_for_lesson = (problems.no_teacher_for_lesson || 0) + 1;
          continue;
        }

        let chosenId: number | null = null;
        let minLoad = Infinity;
        for (const t of teachers) {
          const load = teacherLoad.get(t.teacherDeptId) || 0;
          if (load < minLoad) {
            minLoad = load;
            chosenId = t.teacherDeptId;
          }
        }

        if (chosenId !== null) {
          await ctx.db
            .update(lessons)
            .set({ teacherId: chosenId })
            .where(eq(lessons.id, l.id));
          teacherLoad.set(chosenId, (teacherLoad.get(chosenId) || 0) + 1);
        }
      }

      // 7. Удалить занятия без преподавателя
      const deletedNoTeacher = await ctx.db
        .delete(lessons)
        .where(sql`${lessons.teacherId} IS NULL`)
        .returning();

      // 8. Удалить дубликаты
      await ctx.db.execute(sql`
        DELETE FROM ${lessons}
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM ${lessons}
          GROUP BY curriculum_id, discipline_id, lesson_type_id, unit_id, teacher_id
        )
      `);

      // 9. Статистика
      const [totalLessons] = await ctx.db.select({ cnt: sql<number>`count(*)` }).from(lessons);
      const [uniquePlans] = await ctx.db.select({ cnt: sql<number>`count(distinct curriculum_id)` }).from(lessons);
      const [totalPlans] = await ctx.db.select({ cnt: sql<number>`count(*)` }).from(curriculum);
      const [uniqueTeachers] = await ctx.db.select({ cnt: sql<number>`count(distinct teacher_id)` }).from(lessons);
      const [totalTeachers] = await ctx.db.select({ cnt: sql<number>`count(*)` }).from(disciplineTeachers);

      const unitStats = await ctx.db
        .select({
          total: sql<number>`count(distinct ${lessons.unitId})`,
          streams: sql<number>`count(distinct case when ${unitTypes.name} = 'ПОТОК' then ${lessons.unitId} end)`,
          groups: sql<number>`count(distinct case when ${unitTypes.name} = 'ГРУППА' then ${lessons.unitId} end)`,
          subgroups: sql<number>`count(distinct case when ${unitTypes.name} = 'ПОДГРУППА' then ${lessons.unitId} end)`,
        })
        .from(lessons)
        .innerJoin(units, eq(lessons.unitId, units.id))
        .innerJoin(unitTypes, eq(units.unitTypeId, unitTypes.id));

      const typeDistribution = await ctx.db
        .select({ type: lessonTypes.name, count: sql<number>`count(*)` })
        .from(lessons)
        .innerJoin(lessonTypes, eq(lessons.lessonTypeId, lessonTypes.id))
        .groupBy(lessonTypes.name);

      return {
        lessonsCreated: totalLessons?.cnt ?? 0,
        uniquePlans: uniquePlans?.cnt ?? 0,
        totalPlans: totalPlans?.cnt ?? 0,
        uniqueTeachers: uniqueTeachers?.cnt ?? 0,
        totalTeachers: totalTeachers?.cnt ?? 0,
        unitStats: unitStats[0] ?? {},
        typeDistribution,
        problems,
        deletedNoTeacherCount: deletedNoTeacher.length,
      };
    }),
});