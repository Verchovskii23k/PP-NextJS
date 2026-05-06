// src/server/api/routers/generateLessons.ts
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
  profiles
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export const generateLessonsRouter = router({
  generateLessons: adminProcedure.mutation(async ({ ctx }) => {
    await ctx.db.transaction(async (tx) => {
      await tx.delete(schedule);
      await tx.delete(lessonClassrooms);
      await tx.delete(lessons);
    });

    const mappings = await ctx.db
      .select()
      .from(hourTypeMapping)
      .where(eq(hourTypeMapping.isActive, true));   // ← только активные маппинги
    const hourTypeMap = new Map<string, { lessonTypeId: number; priorityCol: string }>();
    for (const m of mappings) {
      hourTypeMap.set(m.planHourColumn, {
        lessonTypeId: m.lessonTypeId,
        priorityCol: m.priorityColumn,
      });
    }

    const priorityColumnSnake: Record<string, string> = {
      priorityLecture: "priority_lecture",
      priorityWorkshop: "priority_workshop",
      priorityGuidedStudy: "priority_guided_study",
      priorityLab: "priority_lab",
    };

    const plans = await ctx.db
      .select()
      .from(curriculum)
      .where(
        and(
          eq(curriculum.isActive, true),   // ← только активные учебные планы
          sql`${curriculum.hoursLecture} > 0 OR ${curriculum.hoursGuidedStudy} > 0 OR ${curriculum.hoursWorkshop} > 0 OR ${curriculum.hoursLab} > 0`
        )
      );

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
              eq(curriculumProfiles.isActive, true),   // ← добавили
              eq(profiles.isActive, true)
            )
          );
        const profileIds = profileRows.map(r => r.profileId);
        if (profileIds.length === 0) {
          problems.no_profiles = (problems.no_profiles || 0) + 1;
          continue;
        }

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

        const snakeCol = priorityColumnSnake[priorityCol];
        if (!snakeCol) {
          problems.unknown_priority_column = (problems.unknown_priority_column || 0) + 1;
          continue;
        }
        const prioritySql = sql<number>`COALESCE(${sql.identifier(snakeCol)}, 0)`;

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
              eq(unitTypes.isActive, true)   // ← только активные типы юнитов
            )
          );

        if (unitRows.length === 0) {
          problems.no_units = (problems.no_units || 0) + 1;
          continue;
        }

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

    if (lessonsToInsert.length > 0) {
      await ctx.db.insert(lessons).values(lessonsToInsert);
    }

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
            eq(disciplineTeachers.isActive, true)   // ← только активные преподаватели дисциплин
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

    const deletedNoTeacher = await ctx.db
      .delete(lessons)
      .where(sql`${lessons.teacherId} IS NULL`)
      .returning();

    await ctx.db.execute(sql`
      DELETE FROM ${lessons}
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM ${lessons}
        GROUP BY curriculum_id, discipline_id, lesson_type_id, unit_id, teacher_id
      )
    `);

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