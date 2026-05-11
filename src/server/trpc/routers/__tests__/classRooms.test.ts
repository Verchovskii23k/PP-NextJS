import { beforeAll, describe, expect, it } from 'vitest';
import { seedTestData } from '@/test/fixtures/fixtures';
import { createTestCaller } from '@/test/trpc';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let ids: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  ids = await seedTestData();
  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('classrooms CRUD', () => {
  let roomId: number;

  it('should create a classroom', async () => {
    const [room] = await caller.classrooms.create({
      buildingId: ids.buildingId,
      roomNumber: '999',
      capacity: 30,
    });
    expect(room).toHaveProperty('id');
    roomId = room.id;
  });

  it('should list classrooms', async () => {
    const list = await caller.classrooms.list();
    expect(list.some(r => r.id === roomId)).toBe(true);
  });

  it('should get a classroom', async () => {
    const room = await caller.classrooms.get({ id: roomId });
    expect(room?.roomNumber).toBe('999');
  });

  it('should update a classroom', async () => {
    await caller.classrooms.update({ id: roomId, capacity: 35 });
    const room = await caller.classrooms.get({ id: roomId });
    expect(room?.capacity).toBe(35);
  });

  it('should delete a classroom', async () => {
    await caller.classrooms.delete({ id: roomId });
    const room = await caller.classrooms.get({ id: roomId });
    expect(room).toBeNull();
  });
});