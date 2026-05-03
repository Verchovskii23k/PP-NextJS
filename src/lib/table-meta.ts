// src/lib/table-meta.ts
export interface FieldMeta {
  dbName: string;
  displayName: string;
  isFK: boolean;
  references?: {
    table: string;       // ключ из этого же объекта tablesMeta
    displayField: string;
    dbTableName?: string; // реальное имя таблицы (если отличается от ключа)
  };
}

export interface TableMeta {
  nameRu: string;
  fields: FieldMeta[];
  routerKey: string;
  dbTableName: string;
}

export const tablesMeta: Record<string, TableMeta> = {
  institutes: {
    nameRu: "Институты",
    routerKey: "institutes",
    dbTableName: "institutes",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "universityCode", displayName: "Код университета", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
    ],
  },
  buildings: {
    nameRu: "Корпуса",
    routerKey: "buildings",
    dbTableName: "buildings",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "number", displayName: "Номер", isFK: false },
    ],
  },
  departments: {
    nameRu: "Кафедры",
    routerKey: "departments",
    dbTableName: "departments",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false },
      { dbName: "instituteId", displayName: "Институт", isFK: true, references: { table: "institutes", displayField: "name" } },
      { dbName: "departmentCode", displayName: "Код кафедры", isFK: false },
    ],
  },
  specialties: {
    nameRu: "Специальности",
    routerKey: "specialties",
    dbTableName: "specialties",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" } },
    ],
  },
  profiles: {
    nameRu: "Профили",
    routerKey: "profiles",
    dbTableName: "profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "specialtyId", displayName: "Специальность", isFK: true, references: { table: "specialties", displayField: "name" } },
      { dbName: "letterCode", displayName: "Буквенный код", isFK: false },
    ],
  },
  disciplines: {
    nameRu: "Дисциплины",
    routerKey: "disciplines",
    dbTableName: "disciplines",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" } },
    ],
  },
  unitTypes: {
    nameRu: "Типы юнитов",
    routerKey: "unitTypes",
    dbTableName: "unit_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "maxSize", displayName: "Макс. размер", isFK: false },
      { dbName: "priorityLecture", displayName: "Приоритет лекций", isFK: false },
      { dbName: "priorityWorkshop", displayName: "Приоритет практик", isFK: false },
      { dbName: "priorityGuidedStudy", displayName: "Приоритет КСР", isFK: false },
      { dbName: "priorityLab", displayName: "Приоритет лаб.", isFK: false },
    ],
  },
  lessonTypes: {
    nameRu: "Типы занятий",
    routerKey: "lessonTypes",
    dbTableName: "lesson_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false },
    ],
  },
  classrooms: {
    nameRu: "Аудитории",
    routerKey: "classrooms",
    dbTableName: "classrooms",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "buildingId", displayName: "Корпус", isFK: true, references: { table: "buildings", displayField: "number" } },
      { dbName: "roomNumber", displayName: "Номер аудитории", isFK: false },
      { dbName: "capacity", displayName: "Вместимость", isFK: false },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" } },
      { dbName: "priorityLecture", displayName: "Приоритет лекций", isFK: false },
      { dbName: "priorityWorkshop", displayName: "Приоритет практик", isFK: false },
      { dbName: "priorityGuidedStudy", displayName: "Приоритет КСР", isFK: false },
      { dbName: "priorityLab", displayName: "Приоритет лаб.", isFK: false },
      { dbName: "usageMetric", displayName: "Метрика использования", isFK: false },
    ],
  },
  employees: {
    nameRu: "Сотрудники",
    routerKey: "employees",
    dbTableName: "employees",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "surname", displayName: "Фамилия", isFK: false },
      { dbName: "name", displayName: "Имя", isFK: false },
      { dbName: "patronymic", displayName: "Отчество", isFK: false },
      { dbName: "phone", displayName: "Телефон", isFK: false },
      { dbName: "email", displayName: "Email", isFK: false },
      { dbName: "isInactive", displayName: "Неактивен", isFK: false },
    ],
  },
  students: {
    nameRu: "Студенты",
    routerKey: "students",
    dbTableName: "students",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "surname", displayName: "Фамилия", isFK: false },
      { dbName: "name", displayName: "Имя", isFK: false },
      { dbName: "admissionYear", displayName: "Год поступления", isFK: false },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name" } },
      { dbName: "studyGroupId", displayName: "Учебная группа", isFK: true, references: { table: "studyGroups", displayField: "code" } },
      { dbName: "course", displayName: "Курс", isFK: false },
      { dbName: "phone", displayName: "Телефон", isFK: false },
      { dbName: "email", displayName: "Email", isFK: false },
      { dbName: "isInactive", displayName: "Неактивен", isFK: false },
    ],
  },
  studyGroups: {
    nameRu: "Учебные группы",
    routerKey: "studyGroups",
    dbTableName: "study_groups",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код группы", isFK: false },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name" } },
      { dbName: "course", displayName: "Курс", isFK: false },
      { dbName: "studentCount", displayName: "Кол-во студентов", isFK: false },
    ],
  },
  units: {
    nameRu: "Юниты",
    routerKey: "units",
    dbTableName: "units",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код юнита", isFK: false },
      { dbName: "unitTypeId", displayName: "Тип юнита", isFK: true, references: { table: "unitTypes", displayField: "name" } },
    ],
  },
  lessons: {
    nameRu: "Занятия",
    routerKey: "lessons",
    dbTableName: "lessons",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "id" } },
      { dbName: "unitId", displayName: "Юнит", isFK: true, references: { table: "units", displayField: "code" } },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name" } },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" } },
      { dbName: "teacherId", displayName: "Преподаватель", isFK: true, references: { table: "employees", displayField: "id" } },
      { dbName: "countPerSemester", displayName: "На семестр", isFK: false },
    ],
  },
  // ----- НОВЫЕ ТАБЛИЦЫ -----
  curriculum: {
    nameRu: "Учебные планы",
    routerKey: "curriculum",
    dbTableName: "curriculum",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "course", displayName: "Курс", isFK: false },
      { dbName: "semester", displayName: "Семестр", isFK: false },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" } },
      { dbName: "hoursLecture", displayName: "Часов лекций", isFK: false },
      { dbName: "hoursGuidedStudy", displayName: "Часов КСР", isFK: false },
      { dbName: "hoursWorkshop", displayName: "Часов практик", isFK: false },
      { dbName: "hoursLab", displayName: "Часов лаб.", isFK: false },
      { dbName: "additionalTaskId", displayName: "Доп. задача", isFK: true, references: { table: "academicLoadTypes", displayField: "name" } },
      { dbName: "controlTypeId", displayName: "Тип контроля", isFK: true, references: { table: "controlTypes", displayField: "name" } },
    ],
  },
  lessonClassrooms: {
    nameRu: "Аудитории занятий",
    routerKey: "lessonClassrooms",
    dbTableName: "lesson_classrooms",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "lessonId", displayName: "Занятие", isFK: true, references: { table: "lessons", displayField: "id" } },
      { dbName: "classroomId", displayName: "Аудитория", isFK: true, references: { table: "classrooms", displayField: "roomNumber" } },
    ],
  },
  unitRoots: {
    nameRu: "Корни юнитов",
    routerKey: "unitRoots",
    dbTableName: "unit_roots",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "unitCode", displayName: "Код юнита", isFK: false },  // <-- убрали isFK: true и references
      { dbName: "studyGroupId", displayName: "Учебная группа", isFK: true, references: { table: "studyGroups", displayField: "code" } },
    ],
  },
  curriculumProfiles: {
    nameRu: "Профили учебных планов",
    routerKey: "curriculumProfiles",
    dbTableName: "curriculum_profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "id" } },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name" } },
    ],
  },
  academicLoadTypes: {
    nameRu: "Типы нагрузки",
    routerKey: "academicLoadTypes",
    dbTableName: "academic_load_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "abbreviation", displayName: "Сокращение", isFK: false },
    ],
  },
  controlTypes: {
    nameRu: "Типы контроля",
    routerKey: "controlTypes",
    dbTableName: "control_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "abbreviation", displayName: "Сокращение", isFK: false },
    ],
  },
  hourTypeMapping: {
    nameRu: "Соответствие часов",
    routerKey: "hourTypeMapping",
    dbTableName: "hour_type_mapping",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "planHourColumn", displayName: "План часов", isFK: false },
      { dbName: "priorityColumn", displayName: "Приоритет", isFK: false },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name" } },
    ],
  },
  employeesDepartments: {
    nameRu: "Сотрудники кафедр",
    routerKey: "employeesDepartments",
    dbTableName: "employees_departments",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "employeeId", displayName: "Сотрудник", isFK: true, references: { table: "employees", displayField: "id" } },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" } },
      { dbName: "employmentType", displayName: "Тип занятости", isFK: false },
      { dbName: "position", displayName: "Должность", isFK: false },
    ],
  },
  disciplineTeachers: {
    nameRu: "Преподаватели дисциплин",
    routerKey: "disciplineTeachers",
    dbTableName: "discipline_teachers",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name" } },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" } },
      { dbName: "teacherDepartmentId", displayName: "Преподаватель", isFK: true, references: { table: "employeesDepartments", displayField: "id" } },
    ],
  },
  daysOfWeek: {
    nameRu: "Дни недели",
    routerKey: "daysOfWeek",
    dbTableName: "days_of_week",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "День", isFK: false },
    ],
  },
  pairs: {
    nameRu: "Пары",
    routerKey: "pairs",
    dbTableName: "pairs",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "number", displayName: "Номер пары", isFK: false },
    ],
  },
  weeks: {
    nameRu: "Недели",
    routerKey: "weeks",
    dbTableName: "weeks",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "type", displayName: "Тип", isFK: false },
    ],
  },
};

export const tableNames = Object.entries(tablesMeta).map(([key, value]) => ({
  key,
  label: value.nameRu,
}));