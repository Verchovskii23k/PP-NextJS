/**
 * Тесты для crudImportExport роутера.
 *
 * Проверяет экспорт таблиц и импорт данных с валидацией,
 * вставкой, обновлением и пропуском неизменённых записей.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  clearAllTestData,
  createTestInstitute,
} from '@/test/helpers';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { institutes } from '@/db/schema';
import { eq } from 'drizzle-orm';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await clearAllTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('crudImportExport', () => {
  describe('exportAll', () => {
    it('экспортирует все записи таблицы', async () => {
      const id1 = await createTestInstitute({ name: 'И1', universityCode: 10001 });
      const id2 = await createTestInstitute({ name: 'И2', universityCode: 10002 });

      const result = await caller.crudImportExport.exportAll({ tableName: 'institutes' });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      const ids = result.map((r) => (r as Record<string, unknown>).id as number);
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
    });

    it('возвращает пустой массив для пустой таблицы', async () => {
      const result = await caller.crudImportExport.exportAll({ tableName: 'buildings' });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('выбрасывает ошибку при невалидном tableName', async () => {
      await expect(
        caller.crudImportExport.exportAll({ tableName: 'nonexistent' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('importData', () => {
    it('вставляет новые записи (insert)', async () => {
    // Очищаем таблицу, чтобы избежать конфликта id с предыдущими тестами
    await db.delete(institutes);

    const result = await caller.crudImportExport.importData({
        tableName: 'institutes',
        data: [
        { id: 1, name: 'Институт А', university_code: 11111, is_active: true },
        { id: 2, name: 'Институт Б', university_code: 22222, is_active: true },
        ],
    });
    expect(result.inserted).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Проверяем реальное наличие в БД
    const rows = await db.select().from(institutes).where(eq(institutes.id, 1));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Институт А');
    });

    it('обновляет существующую запись (update)', async () => {
      const id = await createTestInstitute({ name: 'Старое название', universityCode: 33333 });

      const result = await caller.crudImportExport.importData({
        tableName: 'institutes',
        data: [
          { id, name: 'Новое название', university_code: 33333, is_active: false },
        ],
      });
      expect(result.updated).toBe(1);
      expect(result.inserted).toBe(0);
      expect(result.skipped).toBe(0);

      const [updated] = await db.select().from(institutes).where(eq(institutes.id, id));
      expect(updated.name).toBe('Новое название');
      expect(updated.isActive).toBe(false);
    });

    it('пропускает неизменённую запись (skip)', async () => {
      const id = await createTestInstitute({ name: 'Без изменений', universityCode: 44444 });

      const result = await caller.crudImportExport.importData({
        tableName: 'institutes',
        data: [
          { id, name: 'Без изменений', university_code: 44444, is_active: true },
        ],
      });
      expect(result.skipped).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.inserted).toBe(0);
    });

    it('обрабатывает смешанный импорт: insert + update + skip', async () => {
      const existingId = await createTestInstitute({ name: 'Обновить', universityCode: 55555 });

      const result = await caller.crudImportExport.importData({
        tableName: 'institutes',
        data: [
          { id: existingId, name: 'Обновлён', university_code: 55555, is_active: false },  // update
          { id: 10, name: 'Новый', university_code: 66666, is_active: true },              // insert
          { id: existingId, name: 'Обновлён', university_code: 55555, is_active: false },  // skip (дубль)
        ],
      });
      // Первая строка — update, вторая — insert, третья — skip (по id совпадает с уже обновлённой)
      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('добавляет ошибку при отсутствии id', async () => {
      const result = await caller.crudImportExport.importData({
        tableName: 'institutes',
        data: [ { name: 'Без id' } ] as unknown[],
      });
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('без id');
    });

    it('добавляет ошибку при пропуске обязательного поля', async () => {
      const result = await caller.crudImportExport.importData({
        tableName: 'institutes',
        data: [ { id: 20, name: 'Без кода' } ] as unknown[],
      });
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Код университета');
    });

    it('выбрасывает ошибку при невалидном tableName', async () => {
      await expect(
        caller.crudImportExport.importData({
          tableName: 'no_table',
          data: [],
        })
      ).rejects.toThrow(TRPCError);
    });
  });
});