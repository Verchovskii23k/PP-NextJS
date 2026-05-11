// src/app/admin/settings/optimization/page.tsx
"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";
import { toast } from "sonner";

const KEYS = {
  teacherWindow: "opt_weight_teacher_window",
  groupWindow: "opt_weight_group_window",
  dailyBalance: "opt_weight_daily_balance",
  typeDiversity: "opt_weight_type_diversity",
  singleLessonDay: "opt_weight_single_lesson_day",
  unitMisuse: "opt_weight_unit_misuse",
};

export default function OptimizationSettingsPage() {
  // Загружаем каждую настройку отдельным хуком
  const qTeacher = trpc.settings.get.useQuery({ key: KEYS.teacherWindow });
  const qGroup = trpc.settings.get.useQuery({ key: KEYS.groupWindow });
  const qBalance = trpc.settings.get.useQuery({ key: KEYS.dailyBalance });
  const qDiversity = trpc.settings.get.useQuery({ key: KEYS.typeDiversity });
  const qSingle = trpc.settings.get.useQuery({ key: KEYS.singleLessonDay });
  const qUnit = trpc.settings.get.useQuery({ key: KEYS.unitMisuse });

  const isLoading =
    qTeacher.isLoading ||
    qGroup.isLoading ||
    qBalance.isLoading ||
    qDiversity.isLoading ||
    qSingle.isLoading ||
    qUnit.isLoading;

  const initWeights = {
    teacherWindow: Number(qTeacher.data) || 4,
    groupWindow: Number(qGroup.data) || 8,
    dailyBalance: Number(qBalance.data) || 5,
    typeDiversity: Number(qDiversity.data) || 10,
    singleLessonDay: Number(qSingle.data) || 10,
    unitMisuse: Number(qUnit.data) || 12,
  };

  const [weights, setWeights] = useState(initWeights);

  const updateMut = trpc.settings.update.useMutation({
    onSuccess: () => {toast.success("Сохранено")},
    onError: (e) => {toast.error(e.message)}
  });

  const handleSave = (field: string, value: number) => {
    const key = (KEYS as Record<string, string>)[field];
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
          { label: "Штраф за единственное занятие в день", field: "singleLessonDay", val: weights.singleLessonDay },
          { label: "Штраф за нерациональное использование юнитов", field: "unitMisuse", val: weights.unitMisuse },
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