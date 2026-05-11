import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('disciplineTeachers CRUD', () => {
  let id: number;

  it('create', async () => {
    // нам нужен teacherDepartmentId, который есть в фикстуре (empDeptData)
    // используем сотрудника E1 и дисциплину D2, например
    const [row] = await caller.disciplineTeachers.create({
      lessonTypeId: ids.lessonTypes.lecture,
      disciplineId: ids.disciplines.D2,
      teacherDepartmentId: 1, // первая запись employeesDepartments
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.disciplineTeachers.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.disciplineTeachers.get({ id });
    expect(row?.disciplineId).toBe(ids.disciplines.D2);
  });

  it('update', async () => {
    await caller.disciplineTeachers.update({ id, isActive: false });
    const row = await caller.disciplineTeachers.get({ id });
    expect(row?.isActive).toBe(false);
  });

  it('delete', async () => {
    await caller.disciplineTeachers.delete({ id });
    const row = await caller.disciplineTeachers.get({ id });
    expect(row).toBeNull();
  });
});