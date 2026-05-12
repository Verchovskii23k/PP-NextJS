"use client";
import { SkeletonTable } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";
import { useState } from "react";
import { toast } from "sonner";

export default function UsersPage() {
  const { data, isLoading, error } = trpc.userManagement.listUsers.useQuery();
  const resetMut = trpc.userManagement.adminResetCredentials.useMutation();
  const [resetResult, setResetResult] = useState<{
    login?: string;
    password?: string;
    emailSent: boolean;
  } | null>(null);

  if (isLoading) return <div className="p-6"><SkeletonTable rows={5} /></div>;
  if (error) return <div className="p-6 text-red-500">Ошибка: {error.message}</div>;

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto bg-background p-6 text-foreground">
      <h1 className="mb-6 text-2xl font-bold">Управление пользователями</h1>

      {resetResult && (
        <div className="mb-4 rounded border border-border bg-muted p-3">
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

      <table className="w-full rounded-lg border border-border">
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
                          if ('login' in data && 'password' in data) {
                            setResetResult({
                              emailSent: data.emailSent,
                              login: data.login,
                              password: data.password,
                            });
                          } else {
                            setResetResult({ emailSent: data.emailSent });
                          }
                        },
                        onError: (e) => toast.error(e.message),
                      }
                    );
                  }}
                  disabled={resetMut.isPending}
                  className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
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