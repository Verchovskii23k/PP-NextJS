export interface FieldMeta {
  dbName: string;          // имя свойства в коде (camelCase)
  displayName: string;
  isFK: boolean;
  references?: {
    table: string;
    displayField: string;
    dbTableName?: string;
  };
  columnName?: string;      // реальное имя колонки в БД (snake_case)
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
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "universityCode", displayName: "Код университета", isFK: false, columnName: "university_code" },
      { dbName: "name", displayName: "Название", isFK: false, columnName: "name" },
    ],
  },
  buildings: {
    nameRu: "Корпуса",
    routerKey: "buildings",
    dbTableName: "buildings",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "number", displayName: "Номер", isFK: false, columnName: "number" },
    ],
  },
  departments: {
    nameRu: "Кафедры",
    routerKey: "departments",
    dbTableName: "departments",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "name", displayName: "Название", isFK: false, columnName: "name" },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, columnName: "abbreviation" },
      { dbName: "instituteId", displayName: "Институт", isFK: true, references: { table: "institutes", displayField: "name", dbTableName: "institutes" }, columnName: "institute_id" },
      { dbName: "departmentCode", displayName: "Код кафедры", isFK: false, columnName: "department_code" },
    ],
  },
  specialties: {
    nameRu: "Специальности",
    routerKey: "specialties",
    dbTableName: "specialties",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "code", displayName: "Код", isFK: false, columnName: "code" },
      { dbName: "name", displayName: "Название", isFK: false, columnName: "name" },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name", dbTableName: "departments" }, columnName: "department_id" },
    ],
  },
  profiles: {
    nameRu: "Профили",
    routerKey: "profiles",
    dbTableName: "profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "name", displayName: "Название", isFK: false, columnName: "name" },
      { dbName: "specialtyId", displayName: "Специальность", isFK: true, references: { table: "specialties", displayField: "name", dbTableName: "specialties" }, columnName: "specialty_id" },
      { dbName: "letterCode", displayName: "Буквенный код", isFK: false, columnName: "letter_code" },
    ],
  },
  disciplines: {
    nameRu: "Дисциплины",
    routerKey: "disciplines",
    dbTableName: "disciplines",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "name", displayName: "Название", isFK: false, columnName: "name" },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, columnName: "abbreviation" },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name", dbTableName: "departments" }, columnName: "department_id" },
    ],
  },
  unitTypes: {
    nameRu: "Типы юнитов",
    routerKey: "unitTypes",
    dbTableName: "unit_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "name", displayName: "Название", isFK: false, columnName: "name" },
      { dbName: "maxSize", displayName: "Макс. размер", isFK: false, columnName: "max_size" },
      { dbName: "priorityLecture", displayName: "Приоритет лекций", isFK: false, columnName: "priority_lecture" },
      { dbName: "priorityWorkshop", displayName: "Приоритет практик", isFK: false, columnName: "priority_workshop" },
      { dbName: "priorityGuidedStudy", displayName: "Приоритет КСР", isFK: false, columnName: "priority_guided_study" },
      { dbName: "priorityLab", displayName: "Приоритет лаб.", isFK: false, columnName: "priority_lab" },
    ],
  },
  lessonTypes: {
    nameRu: "Типы занятий",
    routerKey: "lessonTypes",
    dbTableName: "lesson_types",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "name", displayName: "Название", isFK: false, columnName: "name" },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false, columnName: "abbreviation" },
    ],
  },
  classrooms: {
    nameRu: "Аудитории",
    routerKey: "classrooms",
    dbTableName: "classrooms",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "buildingId", displayName: "Корпус", isFK: true, references: { table: "buildings", displayField: "number", dbTableName: "buildings" }, columnName: "building_id" },
      { dbName: "roomNumber", displayName: "Номер аудитории", isFK: false, columnName: "room_number" },
      { dbName: "capacity", displayName: "Вместимость", isFK: false, columnName: "capacity" },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name", dbTableName: "departments" }, columnName: "department_id" },
      { dbName: "priorityLecture", displayName: "Приоритет лекций", isFK: false, columnName: "priority_lecture" },
      { dbName: "priorityWorkshop", displayName: "Приоритет практик", isFK: false, columnName: "priority_workshop" },
      { dbName: "priorityGuidedStudy", displayName: "Приоритет КСР", isFK: false, columnName: "priority_guided_study" },
      { dbName: "priorityLab", displayName: "Приоритет лаб.", isFK: false, columnName: "priority_lab" },
      { dbName: "usageMetric", displayName: "Метрика использования", isFK: false, columnName: "usage_metric" },
    ],
  },
  employees: {
    nameRu: "Сотрудники",
    routerKey: "employees",
    dbTableName: "employees",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "surname", displayName: "Фамилия", isFK: false, columnName: "surname" },
      { dbName: "name", displayName: "Имя", isFK: false, columnName: "name" },
      { dbName: "patronymic", displayName: "Отчество", isFK: false, columnName: "patronymic" },
      { dbName: "phone", displayName: "Телефон", isFK: false, columnName: "phone" },
      { dbName: "email", displayName: "Email", isFK: false, columnName: "email" },
      { dbName: "isInactive", displayName: "Неактивен", isFK: false, columnName: "is_inactive" },
    ],
  },
  students: {
    nameRu: "Студенты",
    routerKey: "students",
    dbTableName: "students",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "surname", displayName: "Фамилия", isFK: false, columnName: "surname" },
      { dbName: "name", displayName: "Имя", isFK: false, columnName: "name" },
      { dbName: "admissionYear", displayName: "Год поступления", isFK: false, columnName: "admission_year" },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name", dbTableName: "profiles" }, columnName: "profile_id" },
      { dbName: "studyGroupId", displayName: "Учебная группа", isFK: true, references: { table: "studyGroups", displayField: "code", dbTableName: "study_groups" }, columnName: "study_group_id" },
      { dbName: "course", displayName: "Курс", isFK: false, columnName: "course" },
      { dbName: "phone", displayName: "Телефон", isFK: false, columnName: "phone" },
      { dbName: "email", displayName: "Email", isFK: false, columnName: "email" },
      { dbName: "isInactive", displayName: "Неактивен", isFK: false, columnName: "is_inactive" },
    ],
  },
  studyGroups: {
    nameRu: "Учебные группы",
    routerKey: "studyGroups",
    dbTableName: "study_groups",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "code", displayName: "Код группы", isFK: false, columnName: "code" },
      { dbName: "profileId", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name", dbTableName: "profiles" }, columnName: "profile_id" },
      { dbName: "course", displayName: "Курс", isFK: false, columnName: "course" },
      { dbName: "studentCount", displayName: "Кол-во студентов", isFK: false, columnName: "student_count" },
    ],
  },
  units: {
    nameRu: "Юниты",
    routerKey: "units",
    dbTableName: "units",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "code", displayName: "Код юнита", isFK: false, columnName: "code" },
      { dbName: "unitTypeId", displayName: "Тип юнита", isFK: true, references: { table: "unitTypes", displayField: "name", dbTableName: "unit_types" }, columnName: "unit_type_id" },
    ],
  },
  lessons: {
    nameRu: "Занятия",
    routerKey: "lessons",
    dbTableName: "lessons",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "id", dbTableName: "curriculum" }, columnName: "curriculum_id" },
      { dbName: "unitId", displayName: "Юнит", isFK: true, references: { table: "units", displayField: "code", dbTableName: "units" }, columnName: "unit_id" },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name", dbTableName: "lesson_types" }, columnName: "lesson_type_id" },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name", dbTableName: "disciplines" }, columnName: "discipline_id" },
      { dbName: "teacherId", displayName: "Преподаватель", isFK: true, references: { table: "employeesDepartments", displayField: "id", dbTableName: "employees_departments" }, columnName: "teacher_id" },
      { dbName: "countPerSemester", displayName: "На семестр", isFK: false, columnName: "count_per_semester" },
    ],
  },
  curriculum: {
    nameRu: "Учебные планы",
    routerKey: "curriculum",
    dbTableName: "curriculum",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name", dbTableName: "disciplines" }, columnName: "discipline_id" },
      { dbName: "specialtyId", displayName: "Специальность", isFK: true, references: { table: "specialties", displayField: "name", dbTableName: "specialties" }, columnName: "specialty_id" },
    ],
  },
  employeesDepartments: {
    nameRu: "Сотрудник-Кафедра",
    routerKey: "employeesDepartments",
    dbTableName: "employees_departments",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false, columnName: "id" },
      { dbName: "employeeId", displayName: "Сотрудник", isFK: true, references: { table: "employees", displayField: "surname", dbTableName: "employees" }, columnName: "employee_id" },
      { dbName: "departmentId", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name", dbTableName: "departments" }, columnName: "department_id" },
    ],
  },
};

export const tableNames = Object.entries(tablesMeta).map(([key, value]) => ({
  key,
  label: value.nameRu,
}));