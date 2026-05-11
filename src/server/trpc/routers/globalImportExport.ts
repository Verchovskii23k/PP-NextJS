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
  "schedule",
  "schedule_display",
  "lessons",
  "lesson_classrooms",
  "unit_roots",
  "units",
  "study_groups",
  "curriculum",
  "curriculum_profiles",
  "discipline_teachers",
  "employees_departments",
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
  "students",
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
  // employees и students обрабатываются отдельно (по email)
};

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

export const globalImportExportRouter = router({
  exportAll: adminProcedure.query(async () => {
    const result: Record<string, unknown[]> = {};

    for (const tableName of IMPORT_ORDER) {
      if (EXCLUDED_TABLES.has(tableName)) continue;
      const dbTableName = tablesMeta[tableName]?.dbTableName || tableName;
      try {
        const rows = await db.execute(
          sql`SELECT * FROM ${sql.identifier(dbTableName)}`
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
        if (EXCLUDED_TABLES.has(tableName)) continue;
        const rows = input[tableName];
        if (!rows || rows.length === 0) continue;

        const dbTableName = tablesMeta[tableName]?.dbTableName || tableName;
        stats[tableName] = { inserted: 0, updated: 0, skipped: 0, errors: [] };

        const uniqueKeys = UNIQUE_KEYS[tableName] || [];
        const allowedFields = (tablesMeta[tableName]?.fields || []).map(f => camelToSnake(f.dbName));

        for (const _row of rows) {
          const row = _row as Record<string, unknown>;
          try {
            const dbRow: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(row)) {
              if (key === "id") continue;
              const snakeKey = camelToSnake(key);
              if (allowedFields.includes(snakeKey)) {
                dbRow[snakeKey] = val === undefined ? null : val;
              }
            }

            if (Object.keys(dbRow).length === 0) {
              stats[tableName].skipped++;
              continue;
            }

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
                try {
                  const setEntries = Object.entries(dbRow).map(([k, v]) => sql`${sql.identifier(k)} = ${v}`);
                  await db.execute(sql`UPDATE ${sql.identifier(dbTableName)} SET ${sql.join(setEntries, sql`, `)} WHERE email = ${email}`);
                  stats[tableName].updated++;
                } catch (err: any) {
                  stats[tableName].errors.push(`Update by email failed: ${err.message}`);
                }
              } else {
                try {
                  const columns = Object.keys(dbRow);
                  const values = Object.values(dbRow);
                  await db.execute(
                    sql`INSERT INTO ${sql.identifier(dbTableName)} (${sql.join(columns.map(c => sql.identifier(c)), sql`, `)})
                        VALUES (${sql.join(values.map(v => sql`${v}`), sql`, `)})`
                  );
                  stats[tableName].inserted++;
                } catch (err: any) {
                  stats[tableName].errors.push(`Insert failed: ${err.message}`);
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
                await db.execute(
                  sql`INSERT INTO ${sql.identifier(dbTableName)} (${sql.join(columns.map(c => sql.identifier(c)), sql`, `)})
                      VALUES (${sql.join(values.map(v => sql`${v}`), sql`, `)})`
                );
                stats[tableName].inserted++;
              } catch (err: any) {
                stats[tableName].errors.push(`Insert failed: ${err.message}`);
              }
            } else {
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
                } catch (err: any) {
                  stats[tableName].errors.push(`Update failed: ${err.message}`);
                }
              }
            }
          } catch (err: any) {
            stats[tableName].errors.push(`Row processing error: ${err.message}`);
          }
        }
      }
      return stats;
    }),
});