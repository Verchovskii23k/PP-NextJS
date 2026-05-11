import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('buildings CRUD', () => {
  let buildingId: number;

  it('should create a building', async () => {
    const [bld] = await caller.buildings.create({ number: 99 });
    expect(bld).toHaveProperty('id');
    buildingId = bld.id;
  });

  it('should list buildings', async () => {
    const list = await caller.buildings.list();
    expect(list.some(b => b.id === buildingId)).toBe(true);
  });

  it('should get a building', async () => {
    const bld = await caller.buildings.get({ id: buildingId });
    expect(bld).not.toBeNull();
    expect(bld?.number).toBe(99);
  });

  it('should update a building', async () => {
    await caller.buildings.update({ id: buildingId, number: 100 });
    const bld = await caller.buildings.get({ id: buildingId });
    expect(bld?.number).toBe(100);
  });

  it('should delete a building', async () => {
    await caller.buildings.delete({ id: buildingId });
    const bld = await caller.buildings.get({ id: buildingId });
    expect(bld).toBeNull();
  });

  it('should reject deletion of used building (with classrooms)', async () => {
    // в фикстуре есть класс, привязанный к buildingId=1
    await expect(
      caller.buildings.delete({ id: 1 })
    ).rejects.toThrow(/Невозможно удалить/);
  });
});