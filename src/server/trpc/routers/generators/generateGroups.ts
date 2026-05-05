// src/server/api/routers/generateGroups.ts
import { router, adminProcedure } from "../../trpc";
import {
  students, studyGroups, profiles,
  specialties, departments, institutes,
  unitRoots, lessons, lessonClassrooms, schedule, units
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export const generateGroupsRouter = router({
  generateGroups: adminProcedure.mutation(async ({ ctx }) => {
    // 1. Очистка всех данных, зависящих от групп, в одной транзакции
    await ctx.db.transaction(async (tx) => {
      // Удаляем расписание и занятия, если они есть
      await tx.delete(schedule);
      await tx.delete(lessonClassrooms);
      await tx.delete(lessons);

      // Удаляем связи юнитов с группами и сами юниты
      await tx.delete(unitRoots);
      await tx.delete(units);

      // Обнуляем привязку студентов к группам
      await tx.update(students).set({ studyGroupId: null, course: null });

      // Теперь безопасно удаляем все группы
      await tx.delete(studyGroups);
    });

    // 2. Получаем сгруппированных студентов с необходимыми данными профиля и института
    const groupsData = await ctx.db
      .select({
        profileId: students.profileId,
        admissionYear: students.admissionYear,
        studentCount: sql<number>`COUNT(*)`.mapWith(Number),
        studentIds: sql<number[]>`ARRAY_AGG(${students.id})`.mapWith(ids => ids as number[]),
        letterCode: profiles.letterCode,
        universityCode: institutes.universityCode,
      })
      .from(students)
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(specialties, eq(profiles.specialtyId, specialties.id))
      .innerJoin(departments, eq(specialties.departmentId, departments.id))
      .innerJoin(institutes, eq(departments.instituteId, institutes.id))
      .where(eq(students.isActive, true))
      .groupBy(
        students.profileId,
        students.admissionYear,
        profiles.letterCode,
        institutes.universityCode
      );

    if (groupsData.length === 0) {
      return { createdGroups: 0, assignedStudents: 0 };
    }

    // 3. Расчёт текущего учебного года
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    let academicYearStart: number;
    if (month >= 9) {
      academicYearStart = currentYear;
    } else if (month === 8) {
      academicYearStart = currentYear - 1;
    } else {
      academicYearStart = currentYear - 1;
    }

    let createdGroups = 0;

    // 4. Создание групп и привязка студентов
    await ctx.db.transaction(async (tx) => {
      for (const g of groupsData) {
        const { profileId, admissionYear, studentCount, studentIds, letterCode, universityCode } = g;

        let course = academicYearStart - admissionYear + 1;
        if (month === 8) {
          course = academicYearStart - admissionYear;
        }
        course = Math.max(1, Math.min(6, course));

        const lastDigit = admissionYear % 10;
        const code = `${universityCode}${lastDigit}${letterCode || "П"}`;

        const [inserted] = await tx
          .insert(studyGroups)
          .values({ code, profileId, course, studentCount })
          .returning({ id: studyGroups.id });

        if (studentIds.length > 0) {
          await tx
            .update(students)
            .set({ studyGroupId: inserted.id, course })
            .where(inArray(students.id, studentIds));
        }

        createdGroups++;
      }
    });

    const assignedStudents = groupsData.reduce((sum, g) => sum + g.studentCount, 0);
    return { createdGroups, assignedStudents };
  }),
});




