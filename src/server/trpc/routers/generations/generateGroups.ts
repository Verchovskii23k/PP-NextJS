// src/server/api/routers/generateGroups.ts
import { router, adminProcedure } from "../../trpc";
import {
  students, studyGroups, profiles,
  specialties, departments, institutes,
  unitRoots, lessons, lessonClassrooms, schedule, units,
  scheduleDisplay
} from "@/db/schema";
import { eq, and, inArray, sql, isNull } from "drizzle-orm";

export const generateGroupsRouter = router({
  generateGroups: adminProcedure.mutation(async ({ ctx }) => {
    await ctx.db.transaction(async (tx) => {
      await tx.delete(scheduleDisplay).where(isNull(scheduleDisplay.versionId));
      await tx.delete(schedule);
      await tx.delete(lessonClassrooms).where(isNull(lessonClassrooms.versionId));
      await tx.delete(lessons).where(isNull(lessons.versionId));
      await tx.delete(unitRoots).where(isNull(unitRoots.versionId));
      await tx.delete(units).where(isNull(units.versionId));
      await tx.update(students).set({ studyGroupId: null, course: null });
      await tx.delete(studyGroups);
    });

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
      .where(
        and(
          eq(students.isActive, true),
          eq(profiles.isActive, true),       // ← только активные профили
          eq(specialties.isActive, true),    // ← только активные специальности
          eq(departments.isActive, true),    // ← только активные кафедры
          eq(institutes.isActive, true)      // ← только активные институты
        )
      )
      .groupBy(
        students.profileId,
        students.admissionYear,
        profiles.letterCode,
        institutes.universityCode
      );

    if (groupsData.length === 0) {
      return { createdGroups: 0, assignedStudents: 0 };
    }

    const now = new Date();
    const month = now.getMonth() + 1;
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