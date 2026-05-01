"use client";
import { trpc } from "@/trpc/client";
import { useState, useEffect } from "react";

export default function GenerationsPage() {
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  // ---------- Порог подгруппы из БД ----------
  const { data: subgroupType, isLoading: thresholdLoading } =
    trpc.unitTypes.getByName.useQuery({ name: "ПОДГРУППА" });

  const updateThreshold = trpc.unitTypes.update.useMutation({
    onSuccess: () => {
      utils.unitTypes.getByName.invalidate({ name: "ПОДГРУППА" });
    },
    onError: (e) => setError(e.message),
  });

  const [threshold, setThreshold] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (subgroupType?.maxSize !== undefined) {
      setThreshold(subgroupType.maxSize);
    }
  }, [subgroupType]);

  const handleSaveThreshold = () => {
    if (!subgroupType || threshold === undefined) return;
    updateThreshold.mutate({
      id: subgroupType.id,
      maxSize: threshold,
    });
  };

  // ---------- Мутации генераций ----------
  const groups = trpc.generations.generateGroups.useMutation({
    onSuccess: (data) => {
      setError(null);
      utils.students.list.invalidate();
      utils.studyGroups.list.invalidate();
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

  // ---------- Рендер ----------
  if (thresholdLoading) return <div>Загрузка данных о типах юнитов...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Генерации</h1>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 1. Группы */}
      <div className="space-y-2">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => groups.mutate()}
          disabled={groups.isPending}
        >
          {groups.isPending ? "..." : "1. Сгенерировать учебные группы"}
        </button>
      </div>

      {/* 2. Юниты + управление порогом */}
      <div className="space-y-2">
        <label className="mr-2">Макс. размер подгруппы:</label>
        <input
          type="number"
          value={threshold ?? ""}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="border p-1 w-24"
          placeholder="Загрузка..."
        />
        <button
          className="bg-green-500 text-white px-3 py-1 rounded text-sm ml-2"
          onClick={handleSaveThreshold}
          disabled={updateThreshold.isPending}
        >
          {updateThreshold.isPending ? "Сохраняю..." : "Сохранить"}
        </button>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 ml-2"
          onClick={() => units.mutate({ maxSubgroupSize: threshold ?? 16 })}
          disabled={units.isPending}
        >
          {units.isPending ? "..." : "2. Сгенерировать юниты"}
        </button>
      </div>

      {/* 3. Занятия */}
      <div className="space-y-2">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => lessons.mutate()}
          disabled={lessons.isPending}
        >
          {lessons.isPending ? "..." : "3. Сгенерировать занятия"}
        </button>
      </div>

      {/* 4. Аудитории */}
      <div className="space-y-2">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => classrooms.mutate()}
          disabled={classrooms.isPending}
        >
          {classrooms.isPending ? "..." : "4. Назначить аудитории автоматически"}
        </button>
      </div>

      {/* 5. Расписание */}
      <div className="space-y-2">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => schedule.mutate({ totalWeeks: 16, cycleLength: 2 })}
          disabled={schedule.isPending}
        >
          {schedule.isPending ? "..." : "5. Сгенерировать расписание"}
        </button>
      </div>
    </div>
  );
}