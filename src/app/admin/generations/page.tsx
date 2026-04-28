"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";

export default function GenerationsPage() {
  const [subgroupSize, setSubgroupSize] = useState(15);
  const [totalWeeks, setTotalWeeks] = useState(18);
  const [cycleLength, setCycleLength] = useState(2);

  const [error, setError] = useState<string | null>(null);

  const groups = trpc.generations.generateGroups.useMutation({
    onSuccess: (data) => {
      setError(null);
      alert(`Групп: ${data.createdGroups}, студентов: ${data.assignedStudents}`);
    },
    onError: (e) => setError(e.message),
  });
  const units = trpc.generations.generateUnits.useMutation({
    onSuccess: (data) => {
      setError(null);
      alert(`Создано юнитов: ${data.createdUnits}`);
    },
    onError: (e) => setError(e.message),
  });
  const lessons = trpc.generations.generateLessons.useMutation({
    onSuccess: (data) => {
      setError(null);
      alert(`Создано занятий: ${data.lessonsCreated}`);
    },
    onError: (e) => setError(e.message),
  });
  const classrooms = trpc.generations.assignClassroomsAuto.useMutation({
    onSuccess: (data) => {
      setError(null);
      alert(`Назначено аудиторий: ${data.assignedClassrooms}`);
    },
    onError: (e) => setError(e.message),
  });
  const schedule = trpc.generations.generateSchedule.useMutation({
    onSuccess: () => {
      setError(null);
      alert("Расписание сгенерировано");
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Генерации</h1>
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

      <div className="space-y-2">
        <button className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50" onClick={() => groups.mutate()} disabled={groups.isPending}>
          {groups.isPending ? "..." : "1. Сгенерировать учебные группы"}
        </button>
      </div>

      <div className="space-y-2">
        <label>Макс. размер подгруппы: </label>
        <input type="number" value={subgroupSize} onChange={e => setSubgroupSize(+e.target.value)} className="border p-1" />
        <button className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50" onClick={() => units.mutate({ maxSubgroupSize: subgroupSize })} disabled={units.isPending}>
          {units.isPending ? "..." : "2. Сгенерировать юниты"}
        </button>
      </div>

      <div className="space-y-2">
        <button className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50" onClick={() => lessons.mutate()} disabled={lessons.isPending}>
          {lessons.isPending ? "..." : "3. Сгенерировать занятия"}
        </button>
      </div>

      <div className="space-y-2">
        <button className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50" onClick={() => classrooms.mutate()} disabled={classrooms.isPending}>
          {classrooms.isPending ? "..." : "4. Назначить аудитории автоматически"}
        </button>
      </div>

      <div className="space-y-2">
        <label>Всего недель: </label>
        <input type="number" value={totalWeeks} onChange={e => setTotalWeeks(+e.target.value)} className="border p-1" />
        <label> Длина цикла (чёт/нечет=2): </label>
        <input type="number" value={cycleLength} onChange={e => setCycleLength(+e.target.value)} className="border p-1" />
        <button className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50" onClick={() => schedule.mutate({ totalWeeks, cycleLength })} disabled={schedule.isPending}>
          {schedule.isPending ? "..." : "5. Сгенерировать расписание"}
        </button>
      </div>
    </div>
  );
}