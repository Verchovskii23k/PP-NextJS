// src/lib/table-meta.ts
export interface FieldMeta {
  dbName: string;
  displayName: string;
  isFK: boolean;
  required?: boolean;
  inputType?: "text" | "number" | "select" | "toggle";
  references?: {
    table: string;       // ключ из этого же объекта tablesMeta
    displayField: string;
    dbTableName?: string;
     // реальное имя таблицы (если отличается от ключа)
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
    ],
  },
  buildings: {
    nameRu: "Корпуса",
    routerKey: "buildings",
    dbTableName: "buildings",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "number", displayName: "Номер", isFK: false, required: true },
    ],
  },
  departments: {
    nameRu: "Кафедры",
    routerKey: "departments",
    dbTableName: "departments",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true  },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, required: true  },
      { dbName: "instituteId", displayName: "Институт", isFK: true, references: { table: "institutes", displayField: "name" }, required: true  },
      { dbName: "departmentCode", displayName: "Код кафедры", isFK: false, required: true  },
    ],
  },
  specialties: {
    nameRu: "Специальности",
    routerKey: "specialties",
    dbTableName: "specialties",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код", isFK: false, required: true  },
      { dbName: "name", displayName: "Название", isFK: false, required: true  },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" }, required: true  },
    ],
  },
  profiles: {
    nameRu: "Профили",
    routerKey: "profiles",
    dbTableName: "profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true  },
      { dbName: "specialtyId", displayName: "Специальность", isFK: true, references: { table: "specialties", displayField: "name" }, required: true  },
      { dbName: "letterCode", displayName: "Буквенный код", isFK: false, required: true  },
    ],
  },
  disciplines: {
    nameRu: "Дисциплины",
    routerKey: "disciplines",
    dbTableName: "disciplines",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true  },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, required: true  },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" }, required: true  },
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
      { dbName: "priorityLecture", displayName: "Приоритет лекций", isFK: false,required: true },
      { dbName: "priorityWorkshop", displayName: "Приоритет практик", isFK: false,required: true },
      { dbName: "priorityGuidedStudy", displayName: "Приоритет КСР", isFK: false, required: true },
      { dbName: "priorityLab", displayName: "Приоритет лаб.", isFK: false, required: true },
    ],
  },
  lessonTypes: {
    nameRu: "Типы занятий",
    routerKey: "lessonTypes",
    dbTableName: "lesson_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false,required: true },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, required: true },
    ],
  },
  classrooms: {
    nameRu: "Аудитории",
    routerKey: "classrooms",
    dbTableName: "classrooms",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "buildingId", displayName: "Корпус", isFK: true, references: { table: "buildings", displayField: "number" }, required: true  },
      { dbName: "roomNumber", displayName: "Номер аудитории", isFK: false, required: true  },
      { dbName: "capacity", displayName: "Вместимость", isFK: false, required: true  },
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
      { dbName: "surname", displayName: "Фамилия", isFK: false, required: true  },
      { dbName: "name", displayName: "Имя", isFK: false, required: true  },
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
      { dbName: "surname", displayName: "Фамилия", isFK: false, required: true  },
      { dbName: "name", displayName: "Имя", isFK: false, required: true  },
      { dbName: "admissionYear", displayName: "Год поступления", isFK: false, required: true  },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name" }, required: true  },
      { dbName: "studyGroupId", displayName: "Учебная группа", isFK: true, references: { table: "studyGroups", displayField: "code" } },
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
      { dbName: "code", displayName: "Код группы", isFK: false, required: true  },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name" }, required: true  },
      { dbName: "course", displayName: "Курс", isFK: false, required: true  },
      { dbName: "studentCount", displayName: "Кол-во студентов", isFK: false, required: true  },
    ],
  },
  units: {
    nameRu: "Юниты",
    routerKey: "units",
    dbTableName: "units",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код юнита", isFK: false, required: true  },
      { dbName: "unitTypeId", displayName: "Тип юнита", isFK: true, references: { table: "unitTypes", displayField: "name" }, required: true  },
    ],
  },
  lessons: {
    nameRu: "Занятия",
    routerKey: "lessons",
    dbTableName: "lessons",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "id" }, required: true  },
      { dbName: "unitId", displayName: "Юнит", isFK: true, references: { table: "units", displayField: "code" }, required: true  },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name" }, required: true  },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" }, required: true  },
      { dbName: "teacherId", displayName: "Преподаватель", isFK: true, references: { table: "employees", displayField: "id" }, required: true  },
      { dbName: "countPerSemester", displayName: "На семестр", isFK: false, required: true  },
    ],
  },
  // ----- НОВЫЕ ТАБЛИЦЫ -----
  curriculum: {
    nameRu: "Учебные планы",
    routerKey: "curriculum",
    dbTableName: "curriculum",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "course", displayName: "Курс", isFK: false, required: true  },
      { dbName: "semester", displayName: "Семестр", isFK: false, required: true  },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" }, required: true  },
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
      { dbName: "lessonId", displayName: "Занятие", isFK: true, references: { table: "lessons", displayField: "id" }, required: true  },
      { dbName: "classroomId", displayName: "Аудитория", isFK: true, references: { table: "classrooms", displayField: "roomNumber" }, required: true  },
    ],
  },
  unitRoots: {
    nameRu: "Корни юнитов",
    routerKey: "unitRoots",
    dbTableName: "unit_roots",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "unitCode", displayName: "Код юнита", isFK: false, required: true  },  // <-- убрали isFK: true и references
      { dbName: "studyGroupId", displayName: "Учебная группа", isFK: true, references: { table: "studyGroups", displayField: "code" }, required: true  },
    ],
  },
  curriculumProfiles: {
    nameRu: "Профили учебных планов",
    routerKey: "curriculumProfiles",
    dbTableName: "curriculum_profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "id" }, required: true  },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name" }, required: true  },
    ],
  },
  academicLoadTypes: {
    nameRu: "Типы нагрузки",
    routerKey: "academicLoadTypes",
    dbTableName: "academic_load_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true  },
      { dbName: "abbreviation", displayName: "Сокращение", isFK: false },
    ],
  },
  controlTypes: {
    nameRu: "Типы контроля",
    routerKey: "controlTypes",
    dbTableName: "control_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false, required: true  },
      { dbName: "abbreviation", displayName: "Сокращение", isFK: false },
    ],
  },
  hourTypeMapping: {
    nameRu: "Соответствие часов",
    routerKey: "hourTypeMapping",
    dbTableName: "hour_type_mapping",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "planHourColumn", displayName: "План часов", isFK: false, required: true  },
      { dbName: "priorityColumn", displayName: "Приоритет", isFK: false, required: true  },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name" }, required: true  },
    ],
  },
  employeesDepartments: {
    nameRu: "Сотрудники кафедр",
    routerKey: "employeesDepartments",
    dbTableName: "employees_departments",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "employeeId", displayName: "Сотрудник", isFK: true, references: { table: "employees", displayField: "id" }, required: true  },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" }, required: true  },
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
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name" }, required: true  },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" }, required: true  },
      { dbName: "teacherDepartmentId", displayName: "Преподаватель", isFK: true, references: { table: "employeesDepartments", displayField: "id" }, required: true  },
    ],
  },
  daysOfWeek: {
    nameRu: "Дни недели",
    routerKey: "daysOfWeek",
    dbTableName: "days_of_week",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "День", isFK: false, required: true  },
    ],
  },
  pairs: {
    nameRu: "Пары",
    routerKey: "pairs",
    dbTableName: "pairs",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "number", displayName: "Номер пары", isFK: false, required: true  },
    ],
  },
  weeks: {
    nameRu: "Недели",
    routerKey: "weeks",
    dbTableName: "weeks",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "type", displayName: "Тип", isFK: false, required: true  },
    ],
  },
};

export const tableNames = Object.entries(tablesMeta).map(([key, value]) => ({
  key,
  label: value.nameRu,
}));