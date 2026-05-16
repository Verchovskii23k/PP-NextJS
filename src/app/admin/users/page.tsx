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
  const [search, setSearch] = useState("");

  if (isLoading) return <div className="p-6"><SkeletonTable rows={5} /></div>;
  if (error) return <div className="p-6 text-red-500">Ошибка: {error.message}</div>;

  const filteredData = data?.filter(
    (user) =>
      user.fullName.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.role?.toLowerCase().includes(search.toLowerCase())
  );

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

      <div className="mb-4">
        <input
          type="text"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="p-2 text-left">ФИО</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Роль</th>
              <th className="p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredData?.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="p-2">{user.fullName}</td>
                <td className="p-2">{user.email || "—"}</td>
                <td className="p-2">{user.role || "—"}</td>
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
            {filteredData?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}