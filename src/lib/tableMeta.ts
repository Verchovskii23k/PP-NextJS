export interface FieldMeta {
  dbName: string;
  displayName: string;
  isFK: boolean;
  references?: {
    table: string;   // имя связанной таблицы
    displayField: string; // поле для отображения
  };
}

export interface TableMeta {
  nameRu: string;
  fields: FieldMeta[];
  routerKey: string; // ключ роутера в trpc
}

export const tablesMeta: Record<string, TableMeta> = {
  institutes: {
    nameRu: "Институты",
    routerKey: "institutes",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "university_code", displayName: "Код университета", isFK: false },
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
      { dbName: "institute_id", displayName: "Институт", isFK: true, references: { table: "institutes", displayField: "name" } },
      { dbName: "department_code", displayName: "Код кафедры", isFK: false },
    ],
  },
  specialties: {
    nameRu: "Специальности",
    routerKey: "specialties",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "department_id", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" } },
    ],
  },
  profiles: {
    nameRu: "Профили",
    routerKey: "profiles",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "specialty_id", displayName: "Специальность", isFK: true, references: { table: "specialties", displayField: "name" } },
      { dbName: "letter_code", displayName: "Буквенный код", isFK: false },
    ],
  },
  disciplines: {
    nameRu: "Дисциплины",
    routerKey: "disciplines",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "abbreviation", displayName: "Аббревиатура", isFK: false },
      { dbName: "department_id", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" } },
    ],
  },
  unitTypes: {
    nameRu: "Типы юнитов",
    routerKey: "unitTypes",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "name", displayName: "Название", isFK: false },
      { dbName: "max_size", displayName: "Макс. размер", isFK: false },
      { dbName: "priority_lecture", displayName: "Приоритет лекций", isFK: false },
      { dbName: "priority_workshop", displayName: "Приоритет практик", isFK: false },
      { dbName: "priority_guided_study", displayName: "Приоритет КСР", isFK: false },
      { dbName: "priority_lab", displayName: "Приоритет лаб.", isFK: false },
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
      { dbName: "building_id", displayName: "Корпус", isFK: true, references: { table: "buildings", displayField: "number" } },
      { dbName: "room_number", displayName: "Номер аудитории", isFK: false },
      { dbName: "capacity", displayName: "Вместимость", isFK: false },
      { dbName: "department_id", displayName: "Кафедра", isFK: true, references: { table: "departments", displayField: "name" } },
      { dbName: "priority_lecture", displayName: "Приоритет лекций", isFK: false },
      { dbName: "priority_workshop", displayName: "Приоритет практик", isFK: false },
      { dbName: "priority_guided_study", displayName: "Приоритет КСР", isFK: false },
      { dbName: "priority_lab", displayName: "Приоритет лаб.", isFK: false },
      { dbName: "usage_metric", displayName: "Метрика использования", isFK: false },
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
      { dbName: "is_inactive", displayName: "Неактивен", isFK: false },
    ],
  },
  students: {
    nameRu: "Студенты",
    routerKey: "students",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "surname", displayName: "Фамилия", isFK: false },
      { dbName: "name", displayName: "Имя", isFK: false },
      { dbName: "admission_year", displayName: "Год поступления", isFK: false },
      { dbName: "profile_id", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name" } },
      { dbName: "study_group_id", displayName: "Учебная группа", isFK: true, references: { table: "study_groups", displayField: "code" } },
      { dbName: "course", displayName: "Курс", isFK: false },
      { dbName: "phone", displayName: "Телефон", isFK: false },
      { dbName: "email", displayName: "Email", isFK: false },
      { dbName: "is_inactive", displayName: "Неактивен", isFK: false },
    ],
  },
  study_groups: {
    nameRu: "Учебные группы",
    routerKey: "studyGroups",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код группы", isFK: false },
      { dbName: "profile_id", displayName: "Профиль", isFK: true, references: { table: "profiles", displayField: "name" } },
      { dbName: "course", displayName: "Курс", isFK: false },
      { dbName: "student_count", displayName: "Кол-во студентов", isFK: false },
    ],
  },
  units: {
    nameRu: "Юниты",
    routerKey: "units",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код юнита", isFK: false },
      { dbName: "unit_type_id", displayName: "Тип юнита", isFK: true, references: { table: "unitTypes", displayField: "name" } },
    ],
  },
  lessons: {
    nameRu: "Занятия",
    routerKey: "lessons",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculum_id", displayName: "Учебный план", isFK: true, references: { table: "curriculum", displayField: "id" } },
      { dbName: "unit_id", displayName: "Юнит", isFK: true, references: { table: "units", displayField: "code" } },
      { dbName: "lesson_type_id", displayName: "Тип занятия", isFK: true, references: { table: "lessonTypes", displayField: "name" } },
      { dbName: "discipline_id", displayName: "Дисциплина", isFK: true, references: { table: "disciplines", displayField: "name" } },
      { dbName: "teacher_id", displayName: "Преподаватель", isFK: true, references: { table: "employeesDepartments", displayField: "id" } },
      { dbName: "count_per_semester", displayName: "На семестр", isFK: false },
    ],
  },
};