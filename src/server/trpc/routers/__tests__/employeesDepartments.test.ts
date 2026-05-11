import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('employeesDepartments CRUD', () => {
  let id: number;

  it('create', async () => {
    const [row] = await caller.employeesDepartments.create({
      employeeId: ids.employees.E1,
      departmentId: ids.departments.B, // другая кафедра, чтобы не конфликтовать с уже существующей связью
    });
    expect(row).toHaveProperty('id');
    id = row.id;
  });

  it('list', async () => {
    const list = await caller.employeesDepartments.list();
    expect(list.some(r => r.id === id)).toBe(true);
  });

  it('get', async () => {
    const row = await caller.employeesDepartments.get({ id });
    expect(row?.employeeId).toBeDefined();
  });

  it('update', async () => {
    await caller.employeesDepartments.update({ id, isActive: false });
    const row = await caller.employeesDepartments.get({ id });
    expect(row?.isActive).toBe(false);
  });

  it('delete', async () => {
    await caller.employeesDepartments.delete({ id });
    const row = await caller.employeesDepartments.get({ id });
    expect(row).toBeNull();
  });
});