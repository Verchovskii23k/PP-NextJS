"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";

export default function UsersPage() {
  const { data, isLoading, error } = trpc.userManagement.listUsers.useQuery();
  const resetMut = trpc.userManagement.adminResetCredentials.useMutation();
  const [resetResult, setResetResult] = useState<{
    login?: string;
    password?: string;
    emailSent: boolean;
  } | null>(null);

  if (isLoading) return <div className="p-6 text-foreground">Загрузка...</div>;
  if (error) return <div className="p-6 text-red-500">Ошибка: {error.message}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6">Управление пользователями</h1>

      {resetResult && (
        <div className="mb-4 p-3 border border-border rounded bg-muted">
          <p className="font-semibold">Учётные данные сброшены</p>
          {resetResult.emailSent ? (
            <p>Новые логин и пароль отправлены на email пользователя.</p>
          ) : (
            <>
              <p className="text-red-500">Email отсутствует – передайте данные вручную:</p>
              <p>Логин: <strong>{resetResult.login}</strong></p>
              <p>Пароль: <strong>{resetResult.password}</strong></p>
            </>
          )}
        </div>
      )}

      <table className="w-full border border-border rounded-lg">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left">ФИО</th>
            <th className="p-2 text-left">Email</th>
            <th className="p-2">Действия</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((user) => (
            <tr key={user.id} className="border-t border-border">
              <td className="p-2">{user.fullName}</td>
              <td className="p-2">{user.email || "—"}</td>
              <td className="p-2 text-center">
                <button
                  onClick={() => {
                    resetMut.mutate(
                      { userId: user.id },
                      {
                        onSuccess: (data) => {
                          setResetResult({
                            emailSent: data.emailSent,
                            login: data.login,
                            password: data.password,
                          });
                        },
                        onError: (e) => alert(e.message),
                      }
                    );
                  }}
                  disabled={resetMut.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                >
                  Сбросить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}