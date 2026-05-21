// src/test/helpers.ts
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import {
  institutes, departments, disciplines, curriculum,
  buildings, classrooms, controlTypes, academicLoadTypes,
  scheduleDisplay, schedule, curriculumProfiles, lessonClassrooms,
  lessons, employeesDepartments, disciplineTeachers, hourTypeMapping,
  lessonTypes, unitRoots, units, unitTypes, daysOfWeek,
  pairs, weeks, students, studyGroups, education,
  educationForms, educationLevels, profiles,
  specialties, employees, positions, employmentTypes,
  settings, scheduleVersions, accounts, users,
} from '@/db/schema';

export async function clearTable(table: PgTable) {
  await db.delete(table);
  const tableName = getTableConfig(table).name;
  await db.execute(sql`
    SELECT setval(pg_get_serial_sequence(${tableName}, 'id'), 1, false)
    WHERE EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = ${tableName} AND column_name = 'id' 
        AND column_default LIKE 'nextval%'
    )
  `);
}

// Очистка нескольких таблиц в правильном порядке (учитывая внешние ключи)
export async function clearTables(...tables: PgTable[]) {
  for (const table of tables) {
    await clearTable(table);
  }
}
export async function clearAllTestData() {
  // Порядок: сначала зависимые (дочерние) таблицы, потом родительские
  const tables = [
    scheduleDisplay, schedule, lessonClassrooms, lessons,
    curriculumProfiles, curriculum, disciplineTeachers,
    employeesDepartments, classrooms,
    hourTypeMapping, lessonTypes,
    unitRoots, units, unitTypes,
    daysOfWeek, pairs, weeks,
    students, studyGroups,
    profiles,  // <-- удаляем до education
    education, 
    specialties,  // <-- удаляем до departments
    disciplines,  // <-- удаляем до departments
    departments,
    institutes, buildings, employees,
    educationLevels, educationForms,  // <-- после education, но без зависимостей
    positions, employmentTypes, academicLoadTypes, controlTypes,
    settings, scheduleVersions,
    accounts, users,
  ];
  for (const t of tables) {
    await db.delete(t);
  }
  await db.execute(sql`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'ALTER SEQUENCE ' || r.sequence_name || ' RESTART WITH 1';
      END LOOP;
    END $$;
  `);
}
/**
 * Создаёт один институт и возвращает его id.
 */
export async function createTestInstitute(overrides?: Partial<typeof institutes.$inferInsert>) {
  const [inst] = await db
    .insert(institutes)
    .values({
      name: 'Тестовый институт',
      universityCode: Math.floor(Math.random() * 90000) + 10000,
      ...overrides,
    })
    .returning({ id: institutes.id });
  return inst.id;
}

/**
 * Создаёт одну кафедру и возвращает её id.
 * Требует instituteId.
 */
export async function createTestDepartment(instituteId: number, overrides?: Partial<typeof departments.$inferInsert>) {
  const [dept] = await db
    .insert(departments)
    .values({
      name: 'Тестовая кафедра',
      abbreviation: `ТК-${Math.floor(Math.random() * 9000)}`,
      instituteId,
      departmentCode: Math.floor(Math.random() * 90000) + 100,
      ...overrides,
    })
    .returning({ id: departments.id });
  return dept.id;
}

/**
 * Создаёт одну дисциплину и возвращает её id.
 * Требует departmentId.
 */
export async function createTestDiscipline(departmentId: number, overrides?: Partial<typeof disciplines.$inferInsert>) {
  const [disc] = await db
    .insert(disciplines)
    .values({
      name: 'Тестовая дисциплина',
      abbreviation: 'ТД',
      departmentId,
      ...overrides,
    })
    .returning({ id: disciplines.id });
  return disc.id;
}

export async function createTestEducation(overrides?: Partial<typeof education.$inferInsert>) {
  // Убедимся, что есть уровень и форма
  let levelId = overrides?.levelId;
  if (!levelId) {
    const [lvl] = await db.select({ id: educationLevels.id }).from(educationLevels).limit(1);
    if (!lvl) {
      const [newLvl] = await db.insert(educationLevels).values({ name: 'Бакалавриат', isActive: true }).returning({ id: educationLevels.id });
      levelId = newLvl.id;
    } else {
      levelId = lvl.id;
    }
  }
  let formId = overrides?.formId;
  if (!formId) {
    const [frm] = await db.select({ id: educationForms.id }).from(educationForms).limit(1);
    if (!frm) {
      const [newFrm] = await db.insert(educationForms).values({ name: 'Очная', isActive: true }).returning({ id: educationForms.id });
      formId = newFrm.id;
    } else {
      formId = frm.id;
    }
  }
  const [edu] = await db
    .insert(education)
    .values({
      levelId,
      formId,
      durationMonths: 48,
      ...overrides,
    })
    .returning({ id: education.id });
  return edu.id;
}

export async function createTestSpecialty(departmentId: number, overrides?: Partial<typeof specialties.$inferInsert>) {
  const [spec] = await db
    .insert(specialties)
    .values({
      code: `TEST-${Math.floor(Math.random() * 9000)}`,
      name: 'Тестовая специальность',
      departmentId,
      ...overrides,
    })
    .returning({ id: specialties.id });
  return spec.id;
}

export async function createTestProfile(specialtyId: number, educationId: number, overrides?: Partial<typeof profiles.$inferInsert>) {
  const [prof] = await db
    .insert(profiles)
    .values({
      name: 'Тестовый профиль',
      letterCode: `t${Math.floor(Math.random() * 100)}`,
      specialtyId,
      educationId,
      ...overrides,
    })
    .returning({ id: profiles.id });
  return prof.id;
}
/**
 * Создаёт сотрудника и возвращает его id.
 */
export async function createTestEmployee(overrides?: Partial<typeof employees.$inferInsert>) {
  const [emp] = await db
    .insert(employees)
    .values({
      surname: 'Тестовый',
      name: 'Сотрудник',
      patronymic: 'Тестович',
      isActive: true,
      ...overrides,
    })
    .returning({ id: employees.id });
  return emp.id;
}

/**
 * Привязывает сотрудника к кафедре и возвращает id связи.
 */
export async function createTestEmployeeDepartment(
  employeeId: number,
  departmentId: number,
  overrides?: Partial<typeof employeesDepartments.$inferInsert>
) {
  const [ed] = await db
    .insert(employeesDepartments)
    .values({
      employeeId,
      departmentId,
      ...overrides,
    })
    .returning({ id: employeesDepartments.id });
  return ed.id;
}

/**
 * Создаёт учебную группу и возвращает её id.
 * Требует profileId.
 */
export async function createTestStudyGroup(
  profileId: number,
  overrides?: Partial<typeof studyGroups.$inferInsert>
) {
  const [grp] = await db
    .insert(studyGroups)
    .values({
      code: `TEST-${Math.floor(Math.random() * 9000)}`,
      profileId,
      course: 1,
      studentCount: 10,
      isActive: true,
      ...overrides,
    })
    .returning({ id: studyGroups.id });
  return grp.id;
}
export async function createTestUser(overrides?: Partial<typeof users.$inferInsert>) {
  const [user] = await db
    .insert(users)
    .values({
      email: `test-${Date.now()}@test.local`,
      role: 'admin',
      ...overrides,
    })
    .returning({ id: users.id });
  return user.id;
}
export async function createTestEmploymentType(overrides?: Partial<typeof employmentTypes.$inferInsert>) {
  const [et] = await db
    .insert(employmentTypes)
    .values({
      name: 'Основная',
      abbreviation: 'ОСН',
      ...overrides,
    })
    .returning({ id: employmentTypes.id });
  return et.id;
}

export async function createTestPosition(overrides?: Partial<typeof positions.$inferInsert>) {
  const [pos] = await db
    .insert(positions)
    .values({
      name: 'Доцент',
      abbreviation: 'доц',
      ...overrides,
    })
    .returning({ id: positions.id });
  return pos.id;
}
export async function createTestUnitType(overrides?: Partial<typeof unitTypes.$inferInsert>) {
  const [ut] = await db
    .insert(unitTypes)
    .values({
      name: 'ГРУППА',
      maxSize: 32,
      priorityLecture: 3,
      priorityWorkshop: 3,
      priorityGuidedStudy: 3,
      priorityLab: 3,
      isActive: true,
      ...overrides,
    })
    .returning({ id: unitTypes.id });
  return ut.id;
}

export async function createTestUnit(unitTypeId: number, overrides?: Partial<typeof units.$inferInsert>) {
  const [u] = await db
    .insert(units)
    .values({
      code: `TEST-UNIT-${Math.floor(Math.random() * 9000)}`,
      unitTypeId,
      isActive: true,
      ...overrides,
    })
    .returning({ id: units.id, code: units.code });
  return u; // возвращаем объект с id и code
}