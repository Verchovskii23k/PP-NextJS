"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";

const KEYS = {
  teacherWindow: "opt_weight_teacher_window",
  groupWindow: "opt_weight_group_window",
  dailyBalance: "opt_weight_daily_balance",
  typeDiversity: "opt_weight_type_diversity",
};

export default function OptimizationSettingsPage() {
  // Загружаем каждую настройку отдельным хуком
  const qTeacher = trpc.settings.get.useQuery({ key: KEYS.teacherWindow });
  const qGroup = trpc.settings.get.useQuery({ key: KEYS.groupWindow });
  const qBalance = trpc.settings.get.useQuery({ key: KEYS.dailyBalance });
  const qDiversity = trpc.settings.get.useQuery({ key: KEYS.typeDiversity });

  const isLoading = qTeacher.isLoading || qGroup.isLoading || qBalance.isLoading || qDiversity.isLoading;

  // Извлекаем значения (если не загружены – показываем 0, это не критично)
  const initWeights = {
    teacherWindow: Number(qTeacher.data) || 4,
    groupWindow: Number(qGroup.data) || 8,
    dailyBalance: Number(qBalance.data) || 5,
    typeDiversity: Number(qDiversity.data) || 10,
  };

  const [weights, setWeights] = useState(initWeights);

  const updateMut = trpc.settings.update.useMutation({
    onSuccess: () => alert("Сохранено"),
    onError: (e) => alert(e.message),
  });

  const handleSave = (field: string, value: number) => {
    const key = (KEYS as any)[field];
    updateMut.mutate({ key, value: String(value) });
  };

  if (isLoading) return <div className="p-6">Загрузка...</div>;

  return (
    <div className="p-6 max-w-xl mx-auto bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6">Параметры оптимизации</h1>
      <div className="space-y-4">
        {[
          { label: "Штраф за окна у преподавателя", field: "teacherWindow", val: weights.teacherWindow },
          { label: "Штраф за окна у группы", field: "groupWindow", val: weights.groupWindow },
          { label: "Штраф за неравномерность по дням", field: "dailyBalance", val: weights.dailyBalance },
          { label: "Штраф за однообразие типов занятий", field: "typeDiversity", val: weights.typeDiversity },
        ].map((item) => (
          <div key={item.field} className="flex items-center gap-4">
            <label className="w-64 text-sm">{item.label}</label>
            <input
              type="number"
              min={1}
              max={100}
              value={item.val}
              onChange={(e) =>
                setWeights({ ...weights, [item.field]: Number(e.target.value) })
              }
              className="border border-border rounded px-2 py-1 w-24"
            />
            <button
              onClick={() => handleSave(item.field, item.val)}
              disabled={updateMut.isPending}
              className="bg-primary text-white px-3 py-1 rounded text-sm"
            >
              Сохранить
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}