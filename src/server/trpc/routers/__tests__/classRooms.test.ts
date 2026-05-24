import { beforeAll, describe, expect, it } from 'vitest';
import { createTestCaller } from '@/test/trpc';
import {
  createTestInstitute,
  createTestDepartment,
  clearAllTestData,
} from '@/test/helpers';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { buildings } from '@/db/schema';

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let buildingId: number;
let deptId: number;

beforeAll(async () => {
  // Очищаем нужные таблицы
  await clearAllTestData();

  // Создаём институт и кафедру для departmentId
  const instId = await createTestInstitute();
  deptId = await createTestDepartment(instId);

  // Создаём здание
  const [b] = await db
    .insert(buildings)
    .values({ number: 1 })
    .returning({ id: buildings.id });
  buildingId = b.id;

  caller = await createTestCaller({ id: 1, role: 'admin' });
});

describe('classrooms CRUD', () => {
  let roomId: number;
  let roomId2: number;

  const mandatoryFields = {
    buildingId,
    roomNumber: '101',
    capacity: 30,
    departmentId: deptId,
    priorityLecture: 3,
    priorityWorkshop: 3,
    priorityGuidedStudy: 3,
    priorityLab: 3,
  };

  it('should create a classroom', async () => {
    const [room] = await caller.classrooms.create({
      ...mandatoryFields,
      buildingId, // гарантируем, что берётся актуальное значение
      departmentId: deptId,
    });
    expect(room).toHaveProperty('id');
    roomId = room.id;
  });

  it('should reject duplicate building + roomNumber', async () => {
    await expect(
      caller.classrooms.create({
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        roomNumber: '101',
        capacity: 40,
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.classrooms.create({
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        roomNumber: '101',
        capacity: 40,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
        expect(e.message).toBe(
          'Аудитория с таким номером в этом корпусе уже существует'
        );
      }
    }
  });

  it('should reject empty roomNumber', async () => {
    await expect(
      caller.classrooms.create({
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        roomNumber: '',
        capacity: 10,
      })
    ).rejects.toThrow();
  });

  it('should reject missing buildingId', async () => {
    const { buildingId, ...rest } = mandatoryFields;
    await expect(
      (caller.classrooms.create as unknown as (data: Record<string, unknown>) => Promise<unknown>)({ ...rest, departmentId: deptId })
    ).rejects.toThrow();
  });

  it('should reject invalid priority values', async () => {
    await expect(
      caller.classrooms.create({
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        roomNumber: '200',
        priorityLecture: 4,
      })
    ).rejects.toThrow();
    await expect(
      caller.classrooms.create({
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        roomNumber: '201',
        priorityWorkshop: 0,
      })
    ).rejects.toThrow();
  });

  it('should list classrooms and contain created one', async () => {
    const list = await caller.classrooms.list();
    expect(list.some((r) => r.id === roomId)).toBe(true);
  });

  it('should get existing classroom', async () => {
    const room = await caller.classrooms.get({ id: roomId });
    expect(room).toMatchObject({
      buildingId,
      roomNumber: '101',
      capacity: 30,
    });
  });

  it('should return null for non-existent id', async () => {
    const room = await caller.classrooms.get({ id: 9999 });
    expect(room).toBeNull();
  });

  it('should update capacity', async () => {
    await caller.classrooms.update({
      id: roomId,
      ...mandatoryFields,
      buildingId,
      departmentId: deptId,
      capacity: 35,
    });
    const room = await caller.classrooms.get({ id: roomId });
    expect(room?.capacity).toBe(35);
  });

  it('should reject update to duplicate building+room', async () => {
    // Создадим вторую аудиторию в том же здании
    const [room2] = await caller.classrooms.create({
      ...mandatoryFields,
      buildingId,
      departmentId: deptId,
      roomNumber: '102',
      capacity: 20,
    });
    roomId2 = room2.id;

    // Пытаемся обновить первую аудиторию на номер '102'
    await expect(
      caller.classrooms.update({
        id: roomId,
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        roomNumber: '102',
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.classrooms.update({
        id: roomId,
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        roomNumber: '102',
      });
    } catch (e) {
      if (e instanceof TRPCError) {
        expect(e.code).toBe('CONFLICT');
      }
    }
  });

  it('should reject update with empty roomNumber', async () => {
    await expect(
      caller.classrooms.update({
        id: roomId,
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        roomNumber: '',
      })
    ).rejects.toThrow();
  });

  it('should reject update with invalid priority', async () => {
    await expect(
      caller.classrooms.update({
        id: roomId,
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        priorityLab: 5,
      })
    ).rejects.toThrow();
  });

  it('should reject update for non-existent id', async () => {
    await expect(
      caller.classrooms.update({
        id: 9999,
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        capacity: 50,
      })
    ).rejects.toThrow(TRPCError);
    try {
      await caller.classrooms.update({
        id: 9999,
        ...mandatoryFields,
        buildingId,
        departmentId: deptId,
        capacity: 50,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe('NOT_FOUND');
      }
    }
  });

  it('should delete an unused classroom', async () => {
    await caller.classrooms.delete({ id: roomId2 });
    const room = await caller.classrooms.get({ id: roomId2 });
    expect(room).toBeNull();
  });

  it('should not fail on non-existent id delete', async () => {
    await expect(caller.classrooms.delete({ id: 9999 })).resolves.toBeDefined();
  });
});