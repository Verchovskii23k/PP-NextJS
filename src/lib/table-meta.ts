export interface FieldMeta {
  dbName: string;
  displayName: string;
  isFK: boolean;
  references?: {
    table: string;          // ключ таблицы (как раньше)
    displayField: string;
    dbTableName?: string;   // реальное имя таблицы в БД (snake_case)
  };
}

export interface TableMeta {
  nameRu: string;
  fields: FieldMeta[];
  routerKey: string;
  dbTableName: string;    // ← новое поле
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
      { dbName: "instituteId", displayName: "Институт", isFK: true, references: { table: "institutes", displayField: "name", dbTableName: "institutes" } },
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
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name", dbTableName: "departments" } },
    ],
  },
  profiles: {
    nameRu: "Профили",
    routerKey: "profiles",
    dbTableName: "profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "specialtyId", displayName: "Специальность", isFK: true, references: { table: "specialties", displayField: "name", dbTableName: "specialties" } },
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
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name", dbTableName: "departments" } },
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
      { dbName: "buildingId", displayName: "Корпус", isFK: true, references: { table: "buildings", displayField: "number", dbTableName: "buildings" } },
      { dbName: "roomNumber", displayName: "Номер аудитории", isFK: false },
      { dbName: "capacity", displayName: "Вместимость", isFK: false },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name", dbTableName: "departments" } },
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
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name", dbTableName: "profiles" } },
      { dbName: "studyGroupId", displayName: "Учебная группа", isFK: true, references: { table: "studyGroups", displayField: "code", dbTableName: "study_groups" } },
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
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name", dbTableName: "profiles" } },
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
      { dbName: "unitTypeId", displayName: "Тип юнита", isFK: true, references: { table: "unitTypes", displayField: "name", dbTableName: "unit_types" } },
    ],
  },
  lessons: {
    nameRu: "Занятия",
    routerKey: "lessons",
    dbTableName: "lessons",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "id", dbTableName: "curriculum" } },
      { dbName: "unitId", displayName: "Юнит", isFK: true, references: { table: "units", displayField: "code", dbTableName: "units" } },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name", dbTableName: "lesson_types" } },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name", dbTableName: "disciplines" } },
      { dbName: "teacherId", displayName: "Преподаватель", isFK: true, references: { table: "employeesDepartments", displayField: "id", dbTableName: "employees_departments" } },
      { dbName: "countPerSemester", displayName: "На семестр", isFK: false },
    ],
  },
};

export const tableNames = Object.entries(tablesMeta).map(([key, value]) => ({
  key,
  label: value.nameRu,
}));