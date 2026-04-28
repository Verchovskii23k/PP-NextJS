// // src/server/api/routers/generateUnits.ts
// import { z } from "zod";
// import { router, adminProcedure } from "../../trpc";
// import {
//   units, unitTypes, unitRoots,
//   studyGroups, profiles,
//   curriculum, curriculumProfiles,
//   lessons, lessonClassrooms, schedule // на всякий случай очистим
// } from "@/db/schema";
// import { eq, and, inArray, sql } from "drizzle-orm";

// export const generateUnitsRouter = router({
//   generateUnits: adminProcedure
//     .input(z.object({ maxSubgroupSize: z.number().int().default(16) }))
//     .mutation(async ({ ctx, input }) => {
//       // 1. Очистка старых юнитов и связанных данных
//       await ctx.db.transaction(async (tx) => {
//         await tx.delete(schedule);
//         await tx.delete(lessonClassrooms);
//         await tx.delete(lessons);
//         await tx.delete(unitRoots);
//         await tx.delete(units);
//       });

//       // 2. Получение ID типов юнитов
//       const [unitTypeGroup] = await ctx.db.select().from(unitTypes).where(eq(unitTypes.name, "ГРУППА")).limit(1);
//       const [unitTypeSubgroup] = await ctx.db.select().from(unitTypes).where(eq(unitTypes.name, "ПОДГРУППА")).limit(1);
//       const [unitTypeStream] = await ctx.db.select().from(unitTypes).where(eq(unitTypes.name, "ПОТОК")).limit(1);
//       if (!unitTypeGroup || !unitTypeSubgroup || !unitTypeStream) {
//         throw new Error("Не все типы юнитов (Группа, Подгруппа, Поток) найдены");
//       }

//       // 3. Получение всех учебных групп (результат generateGroups)
//       const groups = await ctx.db.select().from(studyGroups);
//       if (groups.length === 0) {
//         throw new Error("Нет учебных групп. Сначала выполните генерацию групп.");
//       }

//       // 4. Подготовка: словарь профиль -> ID группы (для потоков)
//       const profileToGroupId = new Map<number, number>();
//       for (const g of groups) {
//         profileToGroupId.set(g.profileId, g.id);
//       }

//       let createdCounts = { groups: 0, subgroups: 0, streams: 0, connections: 0 };

//       // 5. Создание юнитов «ГРУППА» и «ПОДГРУППА»
//       for (const group of groups) {
//         // --- Группа ---
//         const [existingUnit] = await ctx.db.select({ id: units.id }).from(units).where(eq(units.code, group.code)).limit(1);
//         if (!existingUnit) {
//           await ctx.db.insert(units).values({ code: group.code, unitTypeId: unitTypeGroup.id });
//           createdCounts.groups++;
//         }
//         const [root] = await ctx.db.select().from(unitRoots).where(and(eq(unitRoots.unitCode, group.code), eq(unitRoots.studyGroupId, group.id))).limit(1);
//         if (!root) {
//           await ctx.db.insert(unitRoots).values({ unitCode: group.code, studyGroupId: group.id });
//           createdCounts.connections++;
//         }

//         // --- Подгруппы (если > maxSubgroupSize) ---
//         const size = group.studentCount ?? 0;
//         if (size > input.maxSubgroupSize) {
//           for (let i = 1; i <= 2; i++) {
//             const subCode = `${group.code}${i}`;
//             const [existingSub] = await ctx.db.select({ id: units.id }).from(units).where(eq(units.code, subCode)).limit(1);
//             if (!existingSub) {
//               await ctx.db.insert(units).values({ code: subCode, unitTypeId: unitTypeSubgroup.id });
//               createdCounts.subgroups++;
//             }
//             const [subRoot] = await ctx.db.select().from(unitRoots).where(and(eq(unitRoots.unitCode, subCode), eq(unitRoots.studyGroupId, group.id))).limit(1);
//             if (!subRoot) {
//               await ctx.db.insert(unitRoots).values({ unitCode: subCode, studyGroupId: group.id });
//               createdCounts.connections++;
//             }
//           }
//         }
//       }

//       // 6. Потоки (уровень 1 и 2 объединены – поиск по параметрам)
//       // Получаем все связи curriculum_profiles с часами лекций > 0
//       const planRows = await ctx.db
//         .select({
//           curriculumId: curriculum.id,
//           disciplineId: curriculum.disciplineId,
//           course: curriculum.course,
//           semester: curriculum.semester,
//           hoursLecture: curriculum.hoursLecture,
//           profileId: curriculumProfiles.profileId,
//         })
//         .from(curriculum)
//         .innerJoin(curriculumProfiles, eq(curriculum.id, curriculumProfiles.curriculumId))
//         .where(sql`${curriculum.hoursLecture} > 0`);

//       // Группируем на JS по дисциплине, курсу, семестру, часам лекций
//       const groupKey = (r: typeof planRows[0]) =>
//         `${r.disciplineId}_${r.course}_${r.semester}_${r.hoursLecture}`;

//       const streamMap = new Map<string, Set<number>>();
//       for (const row of planRows) {
//         const key = groupKey(row);
//         if (!streamMap.has(key)) {
//           streamMap.set(key, new Set());
//         }
//         streamMap.get(key)!.add(row.profileId);
//       }

//       const createdStreamCombinations = new Set<string>(); // ключ – отсортированные profileId

//       for (const [key, profileSet] of streamMap) {
//         if (profileSet.size < 2) continue; // нужен поток минимум для двух профилей

//         const profileIds = Array.from(profileSet).sort((a, b) => a - b);
//         const profileTuple = profileIds.join(",");
//         if (createdStreamCombinations.has(profileTuple)) continue;

//         // Получаем буквенные коды профилей (сортируем для кода потока)
//         const profilesData = await ctx.db
//           .select({ letterCode: profiles.letterCode })
//           .from(profiles)
//           .where(inArray(profiles.id, profileIds))
//           .orderBy(profiles.letterCode);

//         const sortedCodes = profilesData.map(p => p.letterCode).join("");

//         // Берем первую группу, чтобы определить институт и год
//         const firstProfileId = profileIds[0];
//         const firstGroupId = profileToGroupId.get(firstProfileId);
//         if (!firstGroupId) continue;

//         const [firstGroup] = await ctx.db
//           .select({ code: studyGroups.code })
//           .from(studyGroups)
//           .where(eq(studyGroups.id, firstGroupId))
//           .limit(1);
//         if (!firstGroup) continue;

//         const groupCode = firstGroup.code;
//         const instituteCode = groupCode[0]; // первая цифра кода группы
//         const yearDigit = groupCode[1];     // вторая цифра кода группы
//         const streamCode = `${instituteCode}${yearDigit}${sortedCodes}`;

//         // Создаем юнит потока, если его ещё нет
//         const [existingStream] = await ctx.db
//           .select({ id: units.id })
//           .from(units)
//           .where(eq(units.code, streamCode))
//           .limit(1);
//         if (!existingStream) {
//           await ctx.db.insert(units).values({ code: streamCode, unitTypeId: unitTypeStream.id });
//           createdCounts.streams++;
//         }

//         // Привязываем поток ко всем группам этих профилей
//         for (const pid of profileIds) {
//           const gid = profileToGroupId.get(pid);
//           if (!gid) continue;

//           const [root] = await ctx.db
//             .select()
//             .from(unitRoots)
//             .where(and(eq(unitRoots.unitCode, streamCode), eq(unitRoots.studyGroupId, gid)))
//             .limit(1);
//           if (!root) {
//             await ctx.db.insert(unitRoots).values({ unitCode: streamCode, studyGroupId: gid });
//             createdCounts.connections++;
//           }
//         }

//         createdStreamCombinations.add(profileTuple);
//       }

//       const totalUnits = createdCounts.groups + createdCounts.subgroups + createdCounts.streams;

//       return {
//         createdUnits: totalUnits,
//         groups: createdCounts.groups,
//         subgroups: createdCounts.subgroups,
//         streams: createdCounts.streams,
//         connections: createdCounts.connections,
//       };
//     }),
// });
















// src/server/api/routers/generateUnits.ts
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import {
  units, unitTypes, unitRoots,
  studyGroups, profiles,
  curriculum, curriculumProfiles,
  lessons, lessonClassrooms, schedule
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export const generateUnitsRouter = router({
  generateUnits: adminProcedure
    .input(z.object({ maxSubgroupSize: z.number().int().default(16) }))
    .mutation(async ({ ctx, input }) => {
      // 1. Очистка
      await ctx.db.transaction(async (tx) => {
        await tx.delete(schedule);
        await tx.delete(lessonClassrooms);
        await tx.delete(lessons);
        await tx.delete(unitRoots);
        await tx.delete(units);
      });

      // 2. Типы юнитов
      const [unitTypeGroup] = await ctx.db.select().from(unitTypes).where(eq(unitTypes.name, "ГРУППА")).limit(1);
      const [unitTypeSubgroup] = await ctx.db.select().from(unitTypes).where(eq(unitTypes.name, "ПОДГРУППА")).limit(1);
      const [unitTypeStream] = await ctx.db.select().from(unitTypes).where(eq(unitTypes.name, "ПОТОК")).limit(1);
      if (!unitTypeGroup || !unitTypeSubgroup || !unitTypeStream) {
        throw new Error("Не все типы юнитов найдены");
      }

      // 3. Группы
      const groups = await ctx.db.select().from(studyGroups);
      if (groups.length === 0) throw new Error("Сначала выполните генерацию групп");

      // Словарь: profileId -> { course -> группа }
      const profileCourseToGroup = new Map<number, Map<number, typeof groups[0]>>();
      for (const g of groups) {
        if (!profileCourseToGroup.has(g.profileId)) {
          profileCourseToGroup.set(g.profileId, new Map());
        }
        profileCourseToGroup.get(g.profileId)!.set(g.course, g);
      }

      const counters = { groups: 0, subgroups: 0, streams: 0, connections: 0 };

      // 4. Группы и подгруппы
      for (const group of groups) {
        // --- Группа ---
        const [existing] = await ctx.db.select({ id: units.id }).from(units).where(eq(units.code, group.code)).limit(1);
        if (!existing) {
          await ctx.db.insert(units).values({ code: group.code, unitTypeId: unitTypeGroup.id });
          counters.groups++;
        }
        const [root] = await ctx.db.select().from(unitRoots).where(and(eq(unitRoots.unitCode, group.code), eq(unitRoots.studyGroupId, group.id))).limit(1);
        if (!root) {
          await ctx.db.insert(unitRoots).values({ unitCode: group.code, studyGroupId: group.id });
          counters.connections++;
        }

        // --- Подгруппы ---
        const size = group.studentCount ?? 0;
        if (size > input.maxSubgroupSize) {
          for (let i = 1; i <= 2; i++) {
            const subCode = `${group.code}${i}`;
            const [sub] = await ctx.db.select({ id: units.id }).from(units).where(eq(units.code, subCode)).limit(1);
            if (!sub) {
              await ctx.db.insert(units).values({ code: subCode, unitTypeId: unitTypeSubgroup.id });
              counters.subgroups++;
            }
            const [subRoot] = await ctx.db.select().from(unitRoots).where(and(eq(unitRoots.unitCode, subCode), eq(unitRoots.studyGroupId, group.id))).limit(1);
            if (!subRoot) {
              await ctx.db.insert(unitRoots).values({ unitCode: subCode, studyGroupId: group.id });
              counters.connections++;
            }
          }
        }
      }

      // 5. Потоки
      // Получаем все записи учебного плана + профиль
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

      // Группируем по дисциплине, курсу, семестру, часам лекций
      const streamMap = new Map<string, { course: number; profileIds: Set<number> }>();
      for (const row of planRows) {
        const key = `${row.disciplineId}_${row.course}_${row.semester}_${row.hoursLecture}`;
        if (!streamMap.has(key)) {
          streamMap.set(key, { course: row.course, profileIds: new Set() });
        }
        streamMap.get(key)!.profileIds.add(row.profileId);
      }

      const createdCombinations = new Set<string>();

      for (const [, { course, profileIds }] of streamMap) {
        if (profileIds.size < 2) continue;

        const profArray = Array.from(profileIds).sort((a, b) => a - b);
        const tupleKey = profArray.join(",");
        if (createdCombinations.has(tupleKey)) continue;

        // Буквенные коды профилей, отсортированные
        const pData = await ctx.db
          .select({ letterCode: profiles.letterCode })
          .from(profiles)
          .where(inArray(profiles.id, profArray))
          .orderBy(profiles.letterCode);
        const codes = pData.map(p => p.letterCode).join("");

        // Берём группу первого профиля для этого курса, чтобы узнать год и институт
        const firstProf = profArray[0];
        const groupForCourse = profileCourseToGroup.get(firstProf)?.get(course);
        if (!groupForCourse) continue;

        const groupCode = groupForCourse.code;
        const instituteCode = groupCode[0];
        const yearDigit = groupCode[1];
        const streamCode = `${instituteCode}${yearDigit}${codes}`;

        // Создаём юнит потока
        const [existingStream] = await ctx.db.select({ id: units.id }).from(units).where(eq(units.code, streamCode)).limit(1);
        if (!existingStream) {
          await ctx.db.insert(units).values({ code: streamCode, unitTypeId: unitTypeStream.id });
          counters.streams++;
        }

        // Привязываем только к группам этого курса для каждого профиля
        for (const profId of profArray) {
          const g = profileCourseToGroup.get(profId)?.get(course);
          if (!g) continue;
          const [root] = await ctx.db.select().from(unitRoots).where(and(eq(unitRoots.unitCode, streamCode), eq(unitRoots.studyGroupId, g.id))).limit(1);
          if (!root) {
            await ctx.db.insert(unitRoots).values({ unitCode: streamCode, studyGroupId: g.id });
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