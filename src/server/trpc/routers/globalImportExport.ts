// src/server/trpc/routers/globalImportExport.ts
import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tablesMeta } from "@/lib/table-meta";

// Таблицы, которые НЕЛЬЗЯ экспортировать/импортировать
const EXCLUDED_TABLES = new Set([
  "security_center",
  "sessions",
]);

// Порядок таблиц для импорта (родители → потомки)
const IMPORT_ORDER = [
  "roles",
  "education_levels",
  "education_forms",
  "days_of_week",
  "pairs",
  "weeks",
  "lesson_types",
  "unit_types",
  "buildings",
  "positions",
  "employment_types",
  "academic_load_types",
  "control_types",
  "hour_type_mapping",
  "institutes",
  "departments",
  "specialties",
  "disciplines",
  "education",
  "profiles",
  "classrooms",
  "employees",
  "curriculum",
  "curriculum_profiles",
  "employees_departments",
  "discipline_teachers",
  "study_groups",
  "students",
  "units",
  "unit_roots",
  "lessons",
  "lesson_classrooms",
  "schedule",
  "schedule_display",
];

// Уникальные ключи для поиска дубликатов при импорте
const UNIQUE_KEYS: Record<string, string[]> = {
  roles: ["name"],
  education_levels: ["name"],
  education_forms: ["name"],
  days_of_week: ["name"],
  pairs: ["number"],
  weeks: ["type"],
  lesson_types: ["name"],
  unit_types: ["name"],
  buildings: ["number"],
  positions: ["name"],
  employment_types: ["name"],
  academic_load_types: ["name"],
  control_types: ["name"],
  hour_type_mapping: ["plan_hour_column"],
  institutes: ["university_code"],
  departments: ["department_code"],
  specialties: ["code"],
  disciplines: ["name"],
  education: ["level_id", "form_id"],
  profiles: ["letter_code", "specialty_id"],
  classrooms: ["room_number", "building_id"],
  study_groups: ["code"],
  unit_roots: ["unit_code", "study_group_id"],
};

// Отображение старых id на новые для каждой таблицы
type IdMap = Map<number, number>;
const idMaps: Record<string, IdMap> = {};

function snakeToCamel(str: string) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function camelToSnake(str: string) {
  return str.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
}

function transformKeysToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformKeysToCamel);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, val]) => [
        snakeToCamel(key),
        transformKeysToCamel(val),
      ])
    );
  }
  return obj;
}

// Заменяет значения внешних ключей в dbRow на актуальные id согласно картам
function remapForeignKeys(tableName: string, dbRow: Record<string, unknown>): void {
  // FK-столбцы для разных таблиц
  const fkColumns = getForeignKeyColumns(tableName);
  for (const col of fkColumns) {
    const val = dbRow[col];
    if (val === null || val === undefined) continue;
    const numVal = Number(val);
    if (isNaN(numVal)) continue;
    const referencedTable = fkReferences[col];
    if (!referencedTable) continue;
    const map = idMaps[referencedTable];
    if (!map) continue;
    const newId = map.get(numVal);
    if (newId !== undefined) {
      dbRow[col] = newId;
    }
  }
}

// Простейшая карта: имя столбца -> имя родительской таблицы
const fkReferences: Record<string, string> = {
  study_group_id: "study_groups",
  profile_id: "profiles",
  discipline_id: "disciplines",
  additional_task_id: "academic_load_types",
  control_type_id: "control_types",
  curriculum_id: "curriculum",
  employee_id: "employees",
  department_id: "departments",
  employment_type_id: "employment_types",
  position_id: "positions",
  lesson_type_id: "lesson_types",
  teacher_department_id: "employees_departments",
  curator_id: "employees",
  unit_type_id: "unit_types",
  unit_code: "units", // особая связь через code
  unit_id: "units",
  teacher_id: "employees_departments",
  lesson_id: "lessons",
  classroom_id: "classrooms",
  week_id: "weeks",
  day_of_week_id: "days_of_week",
  pair_number_id: "pairs",
  week_number: "weeks",
};

function getForeignKeyColumns(tableName: string): string[] {
  // Упрощённо перечислим столбцы, которые могут быть FK для данной таблицы
  if (tableName === "employees" || tableName === "students") {
    return ["study_group_id", "profile_id"];
  }
  if (tableName === "curriculum") return ["discipline_id", "additional_task_id", "control_type_id"];
  if (tableName === "curriculum_profiles") return ["curriculum_id", "profile_id"];
  if (tableName === "employees_departments") return ["employee_id", "department_id", "employment_type_id", "position_id"];
  if (tableName === "discipline_teachers") return ["lesson_type_id", "discipline_id", "teacher_department_id"];
  if (tableName === "study_groups") return ["profile_id", "curator_id"];
  if (tableName === "units") return ["unit_type_id", "version_id"];
  if (tableName === "unit_roots") return ["unit_code", "study_group_id", "version_id"];
  if (tableName === "lessons") return ["curriculum_id", "unit_id", "lesson_type_id", "discipline_id", "teacher_id", "version_id"];
  if (tableName === "lesson_classrooms") return ["lesson_id", "classroom_id", "version_id"];
  if (tableName === "schedule") return ["lesson_id", "classroom_id", "week_id", "day_of_week_id", "pair_number_id", "version_id"];
  if (tableName === "schedule_display") return ["lesson_id", "classroom_id", "week_id", "day_of_week_id", "pair_number_id", "version_id"];
  return [];
}

export const globalImportExportRouter = router({
  exportAll: adminProcedure.query(async () => {
    const result: Record<string, unknown[]> = {};

    for (const tableName of IMPORT_ORDER) {
      if (EXCLUDED_TABLES.has(tableName)) continue;
      try {
        const rows = await db.execute(
          sql`SELECT * FROM ${sql.identifier(tableName)}`
        );
        result[tableName] = (rows as unknown[]).map((row) =>
          transformKeysToCamel(row)
        );
      } catch (e) {
        console.error(`Export error for table ${tableName}:`, e);
        result[tableName] = [];
      }
    }

    return result;
  }),

  importAll: adminProcedure
    .input(z.record(z.string(), z.array(z.unknown())))
    .mutation(async ({ input }) => {
      const stats: Record<string, { inserted: number; updated: number; skipped: number; errors: string[] }> = {};

      for (const tableName of IMPORT_ORDER) {
        idMaps[tableName] = new Map();
      }

      for (const tableName of IMPORT_ORDER) {
        if (EXCLUDED_TABLES.has(tableName)) continue;
        const rows = input[tableName];
        if (!rows || rows.length === 0) continue;

        const dbTableName = tablesMeta[tableName]?.dbTableName || tableName;
        stats[tableName] = { inserted: 0, updated: 0, skipped: 0, errors: [] };

        const uniqueKeys = UNIQUE_KEYS[tableName] || [];
        const allowedFieldsRaw = tablesMeta[tableName]?.fields?.map(f => camelToSnake(f.dbName)) ?? [];
        const effectiveAllowedFields = allowedFieldsRaw.length > 0 ? allowedFieldsRaw : null;

        for (const _row of rows) {
          const row = _row as Record<string, unknown>;
          try {
            const dbRow: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(row)) {
              if (key === "id") continue;
              const snakeKey = camelToSnake(key);
              if (effectiveAllowedFields === null || effectiveAllowedFields.includes(snakeKey)) {
                dbRow[snakeKey] = val === undefined ? null : val;
              }
            }

            if (Object.keys(dbRow).length === 0) {
              stats[tableName].skipped++;
              continue;
            }

            remapForeignKeys(tableName, dbRow);

            // Для unit_roots: unit_code – это не FK, а обычное текстовое поле, оставляем как есть
            // (маппинг unit_code через remapForeignKeys обработает его, если есть в idMaps units.code → units.id,
            // но у нас карта по id, а не по code, поэтому unit_code остаётся строкой – это правильно)

            // employees / students
            if (tableName === "employees" || tableName === "students") {
              const email = dbRow["email"];
              let existingByEmail: Record<string, unknown> | null = null;
              if (email) {
                const existingRows = (await db.execute(
                  sql`SELECT * FROM ${sql.identifier(dbTableName)} WHERE email = ${email} LIMIT 1`
                )) as unknown[];
                if (existingRows.length > 0) existingByEmail = existingRows[0] as Record<string, unknown>;
              }
              if (existingByEmail) {
                const existingId = existingByEmail.id as number;
                idMaps[tableName].set(Number(row.id), existingId);
                try {
                  const setEntries = Object.entries(dbRow).map(([k, v]) => sql`${sql.identifier(k)} = ${v}`);
                  await db.execute(sql`UPDATE ${sql.identifier(dbTableName)} SET ${sql.join(setEntries, sql`, `)} WHERE email = ${email}`);
                  stats[tableName].updated++;
                } catch (e: unknown) {
                  const message = e instanceof Error ? e.message : "Неизвестная ошибка";
                  stats[tableName].errors.push(`Update failed: ${message}`);
                }
              } else {
                try {
                  const columns = Object.keys(dbRow);
                  const values = Object.values(dbRow);
                  const inserted = await db.execute(
                    sql`INSERT INTO ${sql.identifier(dbTableName)} (${sql.join(columns.map(c => sql.identifier(c)), sql`, `)})
                        VALUES (${sql.join(values.map(v => sql`${v}`), sql`, `)})
                        RETURNING id`
                  );
                  const newId = (inserted as unknown as { id: number }[])[0].id;
                  idMaps[tableName].set(Number(row.id), newId);
                  stats[tableName].inserted++;
                } catch (e: unknown) {
                  const message = e instanceof Error ? e.message : "Неизвестная ошибка";
                  stats[tableName].errors.push(`Update failed: ${message}`);
                }
              }
              continue;
            }

            // остальные таблицы
            let existing: Record<string, unknown> | null = null;
            if (uniqueKeys.length > 0 && uniqueKeys.every(k => dbRow[k] !== undefined && dbRow[k] !== null)) {
              const conditions = uniqueKeys.map(k => sql`${sql.identifier(k)} = ${dbRow[k]}`);
              const whereClause = conditions.length > 1 ? sql.join(conditions, sql` AND `) : conditions[0];
              const existingRows = (await db.execute(
                sql`SELECT * FROM ${sql.identifier(dbTableName)} WHERE ${whereClause} LIMIT 1`
              )) as unknown[];
              if (existingRows.length > 0) existing = existingRows[0] as Record<string, unknown>;
            }

            if (!existing) {
              try {
                const columns = Object.keys(dbRow);
                const values = Object.values(dbRow);
                const inserted = await db.execute(
                  sql`INSERT INTO ${sql.identifier(dbTableName)} (${sql.join(columns.map(c => sql.identifier(c)), sql`, `)})
                      VALUES (${sql.join(values.map(v => sql`${v}`), sql`, `)})
                      RETURNING id`
                );
                const newId = (inserted as unknown as { id: number }[])[0].id;
                idMaps[tableName].set(Number(row.id), newId);
                stats[tableName].inserted++;
              } catch (e: unknown) {
                const message = e instanceof Error ? e.message : "Неизвестная ошибка";
                stats[tableName].errors.push(`Update failed: ${message}`);
              }
            } else {
              const existingId = existing.id as number;
              idMaps[tableName].set(Number(row.id), existingId);
              let changed = false;
              for (const [k, v] of Object.entries(dbRow)) {
                if (existing[k] !== v) { changed = true; break; }
              }
              if (!changed) {
                stats[tableName].skipped++;
              } else {
                try {
                  const setEntries = Object.entries(dbRow).map(([k, v]) => sql`${sql.identifier(k)} = ${v}`);
                  const keyConditions = uniqueKeys.map(k => sql`${sql.identifier(k)} = ${existing![k]}`);
                  const whereClause = keyConditions.length > 1 ? sql.join(keyConditions, sql` AND `) : keyConditions[0];
                  await db.execute(
                    sql`UPDATE ${sql.identifier(dbTableName)} SET ${sql.join(setEntries, sql`, `)} WHERE ${whereClause}`
                  );
                  stats[tableName].updated++;
                } catch (e: unknown) {
                  const message = e instanceof Error ? e.message : "Неизвестная ошибка";
                  stats[tableName].errors.push(`Update failed: ${message}`);
                }
              }
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Неизвестная ошибка";
            stats[tableName].errors.push(`Update failed: ${message}`);
          }
        }
      }

      // Обновляем последовательности
      for (const tableName of IMPORT_ORDER) {
        if (EXCLUDED_TABLES.has(tableName)) continue;
        const dbTableName = tablesMeta[tableName]?.dbTableName || tableName;
        try {
          await db.execute(
            sql`SELECT setval(pg_get_serial_sequence(${dbTableName}, 'id'), coalesce(max(id), 1)) FROM ${sql.identifier(dbTableName)}`
          );
        } catch (e) {
          console.error(`Sequence update error for table ${dbTableName}:`, e);
        }
      }

      return stats;
    }),
});