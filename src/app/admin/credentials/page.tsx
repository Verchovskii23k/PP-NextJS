"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";

export default function CredentialsPage() {
  const [error, setError] = useState<string | null>(null);
  const [credSecurity, setCredSecurity] = useState<"low" | "medium" | "high">("medium");
  const [credLength, setCredLength] = useState<number>(16);
  const [credTargets, setCredTargets] = useState({
    employees: true,
    students: true,
  });
  const [credResult, setCredResult] = useState<{
    count: number;
    credentials: { fullName: string; login: string; password: string; role: string }[];
  } | null>(null);

  const credMut = trpc.generations.generateCredentials.useMutation({
    onSuccess: (data) => setCredResult(data),
    onError: (e) => setError(e.message),
  });
  // Очистка всех учётных записей
  const clearAllMut = trpc.adminManagement.clearAllCredentials.useMutation({
    onSuccess: () => {
      window.location.href = '/setup';
    },
    onError: (e) => setError(e.message),
  });
  const downloadCredentials = () => {
    if (!credResult) return;
    const header = "ФИО;Логин;Пароль;Роль\n";
    const rows = credResult.credentials
      .map((c) => `${c.fullName};${c.login};${c.password};${c.role}`)
      .join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6">Генерация логинов и паролей</h1>
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-background border border-border rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Параметры</h2>
        <div className="flex flex-wrap gap-4 mb-3">
          <div>
            <label className="text-sm text-muted-foreground">Уровень защиты</label>
            <select
              value={credSecurity}
              onChange={(e) => setCredSecurity(e.target.value as any)}
              className="border border-border rounded px-2 py-1 bg-background text-foreground ml-2"
            >
              <option value="low">Низкий (s_фамилия / t_фамилия)</option>
              <option value="medium">Средний (случайный 8‑12 символов)</option>
              <option value="high">Высокий (заданная длина, спецсимволы)</option>
            </select>
          </div>
          {credSecurity === "high" && (
            <div>
              <label className="text-sm text-muted-foreground">Длина логина</label>
              <input
                type="number"
                min={6}
                max={32}
                value={credLength}
                onChange={(e) => setCredLength(Number(e.target.value))}
                className="border border-border rounded px-2 py-1 w-20 bg-background text-foreground ml-2"
              />
            </div>
          )}
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-1 text-sm text-foreground">
              <input
                type="checkbox"
                checked={credTargets.employees}
                onChange={(e) =>
                  setCredTargets({ ...credTargets, employees: e.target.checked })
                }
              />
              Сотрудники
            </label>
            <label className="flex items-center gap-1 text-sm text-foreground">
              <input
                type="checkbox"
                checked={credTargets.students}
                onChange={(e) =>
                  setCredTargets({ ...credTargets, students: e.target.checked })
                }
              />
              Студенты
            </label>
          </div>
        </div>

        <button
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() =>
            credMut.mutate({
              securityLevel: credSecurity,
              loginLength: credSecurity === "high" ? credLength : undefined,
              generateFor: [
                ...(credTargets.employees ? ["employees" as const] : []),
                ...(credTargets.students ? ["students" as const] : []),
              ],
            })
          }
          disabled={credMut.isPending || (!credTargets.employees && !credTargets.students)}
        >
          {credMut.isPending ? "Генерация..." : "Сгенерировать"}
        </button>

        {credResult && (
          <div className="mt-4 p-3 border border-border rounded bg-muted">
            <p className="text-sm mb-2">
              Создано записей: <strong>{credResult.count}</strong>
            </p>
            <div className="max-h-48 overflow-y-auto mb-3 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th>ФИО</th>
                    <th>Логин</th>
                    <th>Пароль</th>
                    <th>Роль</th>
                  </tr>
                </thead>
                <tbody>
                  {credResult.credentials.map((c, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-1 pr-2">{c.fullName}</td>
                      <td className="py-1 pr-2">{c.login}</td>
                      <td className="py-1 pr-2">{c.password}</td>
                      <td className="py-1">{c.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={downloadCredentials}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
            >
              Скачать CSV
            </button>
          </div>
        )}
      </div>
      <div className="bg-background border border-border rounded-lg shadow-sm p-4 mt-4">
        <h2 className="text-lg font-semibold mb-2 text-red-600">Опасная зона</h2>
        <button
          onClick={() => {
            if (window.confirm("Удалить ВСЕ учётные записи (логины/пароли) студентов и сотрудников? Это действие нельзя отменить!")) {
              clearAllMut.mutate();
            }
          }}
          disabled={clearAllMut.isPending}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {clearAllMut.isPending ? "Удаление..." : "Сбросить все учётные записи"}
        </button>
      </div>
    </div>
  );
}