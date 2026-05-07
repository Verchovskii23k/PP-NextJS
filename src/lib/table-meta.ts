// src/lib/table-meta.ts
export interface FieldMeta {
  dbName: string;
  displayName: string;
  isFK: boolean;
  required?: boolean;
  inputType?: "text" | "number" | "select" | "toggle";
  showInCreate?: boolean;
  references?: {
    table: string;
    displayField: string;
    dbTableName?: string;
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
      { dbName: "universityCode", displayName: "Код университета", isFK: false, required: true },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "directorId", displayName: "Директор", isFK: true, references: { table: "employees", displayField: "display" }, showInCreate: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  buildings: {
    nameRu: "Корпуса",
    routerKey: "buildings",
    dbTableName: "buildings",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "number", displayName: "Номер", isFK: false, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  departments: {
    nameRu: "Кафедры",
    routerKey: "departments",
    dbTableName: "departments",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, required: true },
      { dbName: "instituteId", displayName: "Институт", isFK: true, references: { table: "institutes", displayField: "name" }, required: true },
      { dbName: "departmentCode", displayName: "Код кафедры", isFK: false, required: true },
      { dbName: "headId", displayName: "Зав. кафедрой", isFK: true, references: { table: "employees", displayField: "display" } },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  specialties: {
    nameRu: "Специальности",
    routerKey: "specialties",
    dbTableName: "specialties",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код", isFK: false, required: true },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "display" }, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  profiles: {
    nameRu: "Профили",
    routerKey: "profiles",
    dbTableName: "profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "specialtyId", displayName: "Специальность", isFK: true, references: { table: "specialties", displayField: "display" }, required: true },
      { dbName: "letterCode", displayName: "Буквенный код", isFK: false, required: true },
      { dbName: "educationId", displayName: "Образование", isFK: true, references: { table: "education", displayField: "display" } },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  disciplines: {
    nameRu: "Дисциплины",
    routerKey: "disciplines",
    dbTableName: "disciplines",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, required: true },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "display" }, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  unitTypes: {
    nameRu: "Типы юнитов",
    routerKey: "unitTypes",
    dbTableName: "unit_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "maxSize", displayName: "Макс. размер", isFK: false, required: true },
      { dbName: "priorityLecture", displayName: "Приоритет лекций", isFK: false, required: true },
      { dbName: "priorityWorkshop", displayName: "Приоритет практик", isFK: false, required: true },
      { dbName: "priorityGuidedStudy", displayName: "Приоритет КСР", isFK: false, required: true },
      { dbName: "priorityLab", displayName: "Приоритет лаб.", isFK: false, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  lessonTypes: {
    nameRu: "Типы занятий",
    routerKey: "lessonTypes",
    dbTableName: "lesson_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Системное имя", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  classrooms: {
    nameRu: "Аудитории",
    routerKey: "classrooms",
    dbTableName: "classrooms",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "buildingId", displayName: "Корпус", isFK: true, references: { table: "buildings", displayField: "number" }, required: true },
      { dbName: "roomNumber", displayName: "Номер аудитории", isFK: false, required: true },
      { dbName: "capacity", displayName: "Вместимость", isFK: false, required: true },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "display" } },
      { dbName: "priorityLecture", displayName: "Приоритет лекций", isFK: false },
      { dbName: "priorityWorkshop", displayName: "Приоритет практик", isFK: false },
      { dbName: "priorityGuidedStudy", displayName: "Приоритет КСР", isFK: false },
      { dbName: "priorityLab", displayName: "Приоритет лаб.", isFK: false },
      { dbName: "usageMetric", displayName: "Метрика использования", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
    positions: {
    nameRu: "Должности",
    routerKey: "positions",
    dbTableName: "positions",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Сокращение", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" },
    ],
  },
  employmentTypes: {
    nameRu: "Типы занятости",
    routerKey: "employmentTypes",
    dbTableName: "employment_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Сокращение", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" },
    ],
  },
  employees: {
    nameRu: "Сотрудники",
    routerKey: "employees",
    dbTableName: "employees",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "surname", displayName: "Фамилия", isFK: false, required: true },
      { dbName: "name", displayName: "Имя", isFK: false, required: true },
      { dbName: "patronymic", displayName: "Отчество", isFK: false },
      { dbName: "phone", displayName: "Телефон", isFK: false },
      { dbName: "email", displayName: "Email", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" },
    ],
  },
  students: {
    nameRu: "Студенты",
    routerKey: "students",
    dbTableName: "students",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "surname", displayName: "Фамилия", isFK: false, required: true },
      { dbName: "name", displayName: "Имя", isFK: false, required: true },
      { dbName: "admissionYear", displayName: "Год поступления", isFK: false, required: true },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "profileDisplay" }, required: true },
      { dbName: "studyGroupId", displayName: "Учебная группа", isFK: true, references: { table: "studyGroups", displayField: "display" } },
      { dbName: "course", displayName: "Курс", isFK: false },
      { dbName: "phone", displayName: "Телефон", isFK: false },
      { dbName: "email", displayName: "Email", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" },
    ],
  },
  studyGroups: {
    nameRu: "Учебные группы",
    routerKey: "studyGroups",
    dbTableName: "study_groups",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код группы", isFK: false, required: true },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "profileDisplay" }, required: true },
      { dbName: "course", displayName: "Курс", isFK: false, required: true },
      { dbName: "studentCount", displayName: "Кол-во студентов", isFK: false, required: true },
      { dbName: "curatorId", displayName: "Куратор", isFK: true, references: { table: "employees", displayField: "display" } }
    ],
  },
  units: {
    nameRu: "Юниты",
    routerKey: "units",
    dbTableName: "units",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код юнита", isFK: false, required: true },
      { dbName: "unitTypeId", displayName: "Тип юнита", isFK: true, references: { table: "unitTypes", displayField: "name" }, required: true },
    ],
  },
  lessons: {
    nameRu: "Занятия",
    routerKey: "lessons",
    dbTableName: "lessons",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "display" }, required: true },
      { dbName: "unitId", displayName: "Юнит", isFK: true, references: { table: "units", displayField: "display" }, required: true },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "display" }, required: true },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" }, required: true },
      { dbName: "teacherId", displayName: "Преподаватель", isFK: true, references: { table: "employees", displayField: "display" }, required: true },
      { dbName: "countPerSemester", displayName: "На семестр", isFK: false, required: true },
    ],
  },
  curriculum: {
    nameRu: "Учебные планы",
    routerKey: "curriculum",
    dbTableName: "curriculum",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "course", displayName: "Курс", isFK: false, required: true },
      { dbName: "semester", displayName: "Семестр", isFK: false, required: true },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" }, required: true },
      { dbName: "hoursLecture", displayName: "Часов лекций", isFK: false },
      { dbName: "hoursGuidedStudy", displayName: "Часов КСР", isFK: false },
      { dbName: "hoursWorkshop", displayName: "Часов практик", isFK: false },
      { dbName: "hoursLab", displayName: "Часов лаб.", isFK: false },
      { dbName: "additionalTaskId", displayName: "Доп. задача", isFK: true, references: { table: "academicLoadTypes", displayField: "name" } },
      { dbName: "controlTypeId", displayName: "Тип контроля", isFK: true, references: { table: "controlTypes", displayField: "name" } },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  lessonClassrooms: {
    nameRu: "Аудитории занятий",
    routerKey: "lessonClassrooms",
    dbTableName: "lesson_classrooms",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "lessonId", displayName: "Занятие", isFK: true, references: { table: "lessons", displayField: "id" }, required: true },
      { dbName: "classroomId", displayName: "Аудитория", isFK: true, references: { table: "classrooms", displayField: "roomNumber" }, required: true },
    ],
  },
  unitRoots: {
    nameRu: "Корни юнитов",
    routerKey: "unitRoots",
    dbTableName: "unit_roots",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "unitCode", displayName: "Код юнита", isFK: false, required: true },
      { dbName: "studyGroupId", displayName: "Учебная группа", isFK: true, references: { table: "studyGroups", displayField: "display" }, required: true },
    ],
  },
  curriculumProfiles: {
    nameRu: "Учебные планы по профилям",
    routerKey: "curriculumProfiles",
    dbTableName: "curriculum_profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "display" }, required: true },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "profileDisplay" }, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  academicLoadTypes: {
    nameRu: "Типы нагрузки",
    routerKey: "academicLoadTypes",
    dbTableName: "academic_load_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Сокращение", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  controlTypes: {
    nameRu: "Типы контроля",
    routerKey: "controlTypes",
    dbTableName: "control_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Сокращение", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  hourTypeMapping: {
    nameRu: "Соответствие часов",
    routerKey: "hourTypeMapping",
    dbTableName: "hour_type_mapping",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "planHourColumn", displayName: "План часов", isFK: false, required: true },
      { dbName: "priorityColumn", displayName: "Приоритет", isFK: false, required: true },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "display" }, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  employeesDepartments: {
    nameRu: "Сотрудники кафедр",
    routerKey: "employeesDepartments",
    dbTableName: "employees_departments",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "employeeId", displayName: "Сотрудник", isFK: true, references: { table: "employees", displayField: "display" }, required: true },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "display" }, required: true },
      { dbName: "employmentTypeId", displayName: "Тип занятости", isFK: true, references: { table: "employmentTypes", displayField: "name" } },
      { dbName: "positionId", displayName: "Должность", isFK: true, references: { table: "positions", displayField: "name" } },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" },
    ],
  },
  disciplineTeachers: {
    nameRu: "Преподаватели дисциплин",
    routerKey: "disciplineTeachers",
    dbTableName: "discipline_teachers",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "display" }, required: true },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" }, required: true },
      { dbName: "teacherDepartmentId", displayName: "Преподаватель", isFK: true, references: { table: "employeesDepartments", displayField: "id" }, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  daysOfWeek: {
    nameRu: "Дни недели",
    routerKey: "daysOfWeek",
    dbTableName: "days_of_week",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "День", isFK: false, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  pairs: {
    nameRu: "Пары",
    routerKey: "pairs",
    dbTableName: "pairs",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "number", displayName: "Номер пары", isFK: false, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
  weeks: {
    nameRu: "Недели",
    routerKey: "weeks",
    dbTableName: "weeks",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "type", displayName: "Тип", isFK: false, required: true },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" }
    ],
  },
    educationLevels: {
    nameRu: "Уровни образования",
    routerKey: "educationLevels",
    dbTableName: "education_levels",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" },
    ],
  },
  educationForms: {
    nameRu: "Формы обучения",
    routerKey: "educationForms",
    dbTableName: "education_forms",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" },
    ],
  },
  education: {
    nameRu: "Образование",
    routerKey: "education",
    dbTableName: "education",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "levelId", displayName: "Уровень", isFK: true, references: { table: "educationLevels", displayField: "name" }, required: true },
      { dbName: "formId", displayName: "Форма", isFK: true, references: { table: "educationForms", displayField: "name" }, required: true },
      { dbName: "durationMonths", displayName: "Длительность (мес.)", isFK: false },
      { dbName: "isActive", displayName: "Активен", isFK: false, required: true, inputType: "toggle" },
    ],
  },
};

export const tableNames = Object.entries(tablesMeta).map(([key, value]) => ({
  key,
  label: value.nameRu,
}));