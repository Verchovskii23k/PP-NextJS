export interface FieldMeta {
  dbName: string;          // имя поля в БД (snake_case)
  displayName: string;     // русское название
  isFK: boolean;           // является ли внешним ключом
}
export interface TableMeta {
  nameRu: string;          // русское имя таблицы
  fields: FieldMeta[];     // список полей
}
export const tablesMeta: Record<string, TableMeta> = {
  students: {
    nameRu: "Студенты",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "surname", displayName: "Фамилия", isFK: false },
      { dbName: "name", displayName: "Имя", isFK: false },
      { dbName: "admission_year", displayName: "Год поступления", isFK: false },
      { dbName: "profile_id", displayName: "Профиль", isFK: true },
      { dbName: "study_group_id", displayName: "Учебная группа", isFK: true },
      { dbName: "course", displayName: "Курс", isFK: false },
      { dbName: "phone", displayName: "Телефон", isFK: false },
      { dbName: "email", displayName: "Email", isFK: false },
      { dbName: "is_inactive", displayName: "Неактивен", isFK: false },
    ],
  },
  study_groups: {
    nameRu: "Учебные группы",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код группы", isFK: false },
      { dbName: "profile_id", displayName: "Профиль", isFK: true },
      { dbName: "course", displayName: "Курс", isFK: false },
      { dbName: "student_count", displayName: "Кол-во студентов", isFK: false },
      { dbName: "curator_id", displayName: "Куратор", isFK: true },
    ],
  },
  lessons: {
    nameRu: "Занятия",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "curriculum_id", displayName: "Учебный план", isFK: true },
      { dbName: "unit_id", displayName: "Юнит", isFK: true },
      { dbName: "lesson_type_id", displayName: "Тип занятия", isFK: true },
      { dbName: "discipline_id", displayName: "Дисциплина", isFK: true },
      { dbName: "teacher_id", displayName: "Преподаватель", isFK: true },
      { dbName: "count_per_semester", displayName: "На семестр", isFK: false },
    ],
  },
  units: {
    nameRu: "Юниты",
    fields: [
      { dbName: "id", displayName: "ID", isFK: false },
      { dbName: "code", displayName: "Код юнита", isFK: false },
      { dbName: "unit_type_id", displayName: "Тип юнита", isFK: true },
    ],
  },
};