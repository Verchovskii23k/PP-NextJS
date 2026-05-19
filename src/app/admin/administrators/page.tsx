"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";
import { SkeletonTable } from "@/components/ui/skeleton"

export default function AdministratorsPage() {
    interface ToggleAdminResult {
    success: boolean;
    warning?: string;
  }
  const utils = trpc.useUtils(); // <-- добавили
  const { data, isLoading, error } = trpc.adminManagement.listEmployeesWithAdminFlag.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const toggleMutation = trpc.adminManagement.toggleAdmin.useMutation({
    onSuccess: (data: ToggleAdminResult) => {
      if (data.warning) {
        setMutWarning(data.warning);
      }
    },
  });
  const [mutError, setMutError] = useState<string | null>(null);
  const [mutWarning, setMutWarning] = useState<string | null>(null);

  if (isLoading) return <div className="p-6"><SkeletonTable rows={5} /></div>;
  if (error) return <div className="p-6 text-red-500">Ошибка: {error.message}</div>;

 return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto bg-background p-6 text-foreground">
      <h1 className="mb-6 text-2xl font-bold">Управление администраторами</h1>

      {mutError && (
        <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {mutError}
        </div>
      )}
      {mutWarning && (
        <div className="mb-4 rounded border border-yellow-400 bg-yellow-100 px-4 py-3 text-yellow-700">
          {mutWarning}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left">Сотрудник</th>
              <th className="px-4 py-2 text-center">Администратор</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.map((emp) => {
              const isCurrentUser = me?.id === emp.userId;
              return (
                <tr key={emp.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2">
                    {emp.surname} {emp.name} {emp.patronymic ? emp.patronymic + "." : ""}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-muted-foreground">(вы)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => {
                        setMutError(null);
                        setMutWarning(null);
                        toggleMutation.mutate(
                          { employeeId: emp.id, isAdmin: !emp.isAdmin },
                          {
                            onSuccess: (data) => {
                              if (data.warning) {
                                setMutWarning(data.warning);
                              }
                              utils.adminManagement.listEmployeesWithAdminFlag.invalidate();
                            },
                            onError: (e) => setMutError(e.message),
                          }
                        );
                      }}
                      disabled={toggleMutation.isPending || isCurrentUser}
                      title={isCurrentUser ? "Нельзя изменить свою роль" : ""}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        emp.isAdmin ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                      } ${isCurrentUser ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          emp.isAdmin ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
            {data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">
                  Нет активных сотрудников
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}