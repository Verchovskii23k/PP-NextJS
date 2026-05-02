export interface FieldMeta {
  dbName: string;
  displayName: string;
  isFK: boolean;
  references?: {
    table: string;
    displayField: string;
  };
}

export interface TableMeta {
  nameRu: string;
  fields: FieldMeta[];
  routerKey: string;
}

export const tablesMeta: Record<string, TableMeta> = {
  institutes: {
    nameRu: "Институты",
    routerKey: "institutes",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "universityCode", displayName: "Код университета", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
    ],
  },
  buildings: {
    nameRu: "Корпуса",
    routerKey: "buildings",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "number", displayName: "Номер", isFK: false },
    ],
  },
  departments: {
    nameRu: "Кафедры",
    routerKey: "departments",
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
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false },
    ],
  },
  classrooms: {
    nameRu: "Аудитории",
    routerKey: "classrooms",
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
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код юнита", isFK: false },
      { dbName: "unitTypeId", displayName: "Тип юнита", isFK: true, references: { table: "unitTypes", displayField: "name" } },
    ],
  },
  lessons: {
    nameRu: "Занятия",
    routerKey: "lessons",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculumId", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "id" } },
      { dbName: "unitId", displayName: "Юнит", isFK: true, references: { table: "units", displayField: "code" } },
      { dbName: "lessonTypeId", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name" } },
      { dbName: "disciplineId", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" } },
      { dbName: "teacherId", displayName: "Преподаватель", isFK: true, references: { table: "employeesDepartments", displayField: "id" } },
      { dbName: "countPerSemester", displayName: "На семестр", isFK: false },
    ],
  },
};

export const tableNames = Object.entries(tablesMeta).map(([key, value]) => ({
  key,
  label: value.nameRu,
}));