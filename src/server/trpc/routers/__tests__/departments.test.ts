import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';
import { beforeAll, describe, expect, it } from 'vitest';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('departments CRUD', () => {
  it('should create a department', async () => {
    const dept = await caller.departments.create({
      name: 'Новая кафедра',
      abbreviation: 'НК',
      instituteId: ids.instituteId,
      departmentCode: 200,
    });
    // create возвращает массив (из-за .returning()), проверяем первый элемент
    const created = dept[0];
    expect(created).toHaveProperty('id');
    const list = await caller.departments.list();
    expect(list.some(d => d.id === created.id)).toBe(true);
  });

  it('should reject deletion of institute with departments', async () => {
    await expect(
      caller.institutes.delete({ id: ids.instituteId })   // передаём объект
    ).rejects.toThrow(/Невозможно удалить/);
  });
});