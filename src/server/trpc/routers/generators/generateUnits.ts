// src/server/api/routers/generateUnits.ts
import { router, adminProcedure } from "../../trpc";
import {
  units, unitTypes, unitRoots,
  studyGroups, profiles,
  curriculum, curriculumProfiles,
  lessons, lessonClassrooms, schedule,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export const generateUnitsRouter = router({
  generateUnits: adminProcedure.mutation(async ({ ctx }) => {
    // 1. Очистка всего, что зависит от юнитов
    await ctx.db.transaction(async (tx) => {
      await tx.delete(schedule);
      await tx.delete(lessonClassrooms);
      await tx.delete(lessons);
      await tx.delete(unitRoots);
      await tx.delete(units);
    });

    // 2. Типы юнитов (имена должны совпадать с БД – в seed они ЗАГЛАВНЫЕ)
    const [unitTypeGroup] = await ctx.db
      .select()
      .from(unitTypes)
      .where(eq(unitTypes.name, "ГРУППА"))
      .limit(1);
    const [unitTypeSubgroup] = await ctx.db
      .select()
      .from(unitTypes)
      .where(eq(unitTypes.name, "ПОДГРУППА"))
      .limit(1);
    const [unitTypeStream] = await ctx.db
      .select()
      .from(unitTypes)
      .where(eq(unitTypes.name, "ПОТОК"))
      .limit(1);

    if (!unitTypeGroup || !unitTypeSubgroup || !unitTypeStream) {
      throw new Error("Не все типы юнитов найдены");
    }

    // ПОРОГ ДЕЛЕНИЯ – из свойства maxSize типа «Подгруппа»
    const maxSubgroupSize = unitTypeSubgroup.maxSize;

    // 3. Загружаем учебные группы
    const groups = await ctx.db.select().from(studyGroups);
    if (groups.length === 0) throw new Error("Сначала выполните генерацию групп");

    // Карта: profileId -> (course -> группа)
    const profileCourseToGroup = new Map<
      number,
      Map<number, typeof groups[0]>
    >();
    for (const g of groups) {
      if (!profileCourseToGroup.has(g.profileId)) {
        profileCourseToGroup.set(g.profileId, new Map());
      }
      profileCourseToGroup.get(g.profileId)!.set(g.course, g);
    }

    const counters = { groups: 0, subgroups: 0, streams: 0, connections: 0 };

    // 4. Группы и подгруппы
    for (const group of groups) {
      // --- Юнит группы ---
      const unitCode = group.code; // код группы (например, 23к)
      let [existingUnit] = await ctx.db
        .select({ id: units.id })
        .from(units)
        .where(eq(units.code, unitCode))
        .limit(1);
      if (!existingUnit) {
        const [inserted] = await ctx.db.insert(units).values({
          code: unitCode,
          unitTypeId: unitTypeGroup.id,
        }).returning({ id: units.id });
        existingUnit = inserted;
        counters.groups++;
      }

      // Связь с группой
      const [rootExist] = await ctx.db
        .select()
        .from(unitRoots)
        .where(and(eq(unitRoots.unitCode, unitCode), eq(unitRoots.studyGroupId, group.id)))
        .limit(1);
      if (!rootExist) {
        await ctx.db.insert(unitRoots).values({
          unitCode: unitCode,       // <-- явно передаём код
          studyGroupId: group.id,
        });
        counters.connections++;
      }

      // --- Подгруппы ---
      const size = group.studentCount ?? 0;
      if (size > maxSubgroupSize) {
        const numSubgroups = Math.ceil(size / maxSubgroupSize);
        for (let i = 1; i <= numSubgroups; i++) {
          const subCode = `${unitCode}${i}`;
          let [existingSub] = await ctx.db
            .select({ id: units.id })
            .from(units)
            .where(eq(units.code, subCode))
            .limit(1);
          if (!existingSub) {
            const [inserted] = await ctx.db.insert(units).values({
              code: subCode,
              unitTypeId: unitTypeSubgroup.id,
            }).returning({ id: units.id });
            existingSub = inserted;
            counters.subgroups++;
          }
          const [subRootExist] = await ctx.db
            .select()
            .from(unitRoots)
            .where(and(eq(unitRoots.unitCode, subCode), eq(unitRoots.studyGroupId, group.id)))
            .limit(1);
          if (!subRootExist) {
            await ctx.db.insert(unitRoots).values({
              unitCode: subCode,    // <-- явно передаём код подгруппы
              studyGroupId: group.id,
            });
            counters.connections++;
          }
        }
      }
    }

    // 5. Потоки (алгоритм сохранён)
    const planRows = await ctx.db
      .select({
        disciplineId: curriculum.disciplineId,
        course: curriculum.course,
        semester: curriculum.semester,
        hoursLecture: curriculum.hoursLecture,
        profileId: curriculumProfiles.profileId,
      })
      .from(curriculum)
      .innerJoin(curriculumProfiles, eq(curriculum.id, curriculumProfiles.curriculumId))
      .where(sql`${curriculum.hoursLecture} > 0`);

    const streamMap = new Map<string, { course: number; profileIds: Set<number> }>();
    for (const row of planRows) {
      const key = `${row.disciplineId}_${row.course}_${row.semester}_${row.hoursLecture}`;
      if (!streamMap.has(key)) streamMap.set(key, { course: row.course, profileIds: new Set() });
      streamMap.get(key)!.profileIds.add(row.profileId);
    }

    const createdCombinations = new Set<string>();

    for (const [, { course, profileIds }] of streamMap) {
      if (profileIds.size < 2) continue;
      const profArray = Array.from(profileIds).sort((a, b) => a - b);
      const tupleKey = profArray.join(",");
      if (createdCombinations.has(tupleKey)) continue;

      const pData = await ctx.db
        .select({ letterCode: profiles.letterCode })
        .from(profiles)
        .where(inArray(profiles.id, profArray))
        .orderBy(profiles.letterCode);
      const codes = pData.map(p => p.letterCode).join("");

      const firstProf = profArray[0];
      const groupForCourse = profileCourseToGroup.get(firstProf)?.get(course);
      if (!groupForCourse) continue;

      const groupCode = groupForCourse.code;
      const instituteCode = groupCode[0];
      const yearDigit = groupCode[1];
      const streamCode = `${instituteCode}${yearDigit}${codes}`;

      let [existingStream] = await ctx.db
        .select({ id: units.id })
        .from(units)
        .where(eq(units.code, streamCode))
        .limit(1);
      if (!existingStream) {
        const [inserted] = await ctx.db.insert(units).values({
          code: streamCode,
          unitTypeId: unitTypeStream.id,
        }).returning({ id: units.id });
        existingStream = inserted;
        counters.streams++;
      }

      // Связи с группами этого потока
      for (const profId of profArray) {
        const g = profileCourseToGroup.get(profId)?.get(course);
        if (!g) continue;
        const [root] = await ctx.db
          .select()
          .from(unitRoots)
          .where(and(eq(unitRoots.unitCode, streamCode), eq(unitRoots.studyGroupId, g.id)))
          .limit(1);
        if (!root) {
          await ctx.db.insert(unitRoots).values({
            unitCode: streamCode,   // <-- явно передаём код потока
            studyGroupId: g.id,
          });
          counters.connections++;
        }
      }
      createdCombinations.add(tupleKey);
    }

    return {
      createdUnits: counters.groups + counters.subgroups + counters.streams,
      groups: counters.groups,
      subgroups: counters.subgroups,
      streams: counters.streams,
      connections: counters.connections,
    };
  }),
});