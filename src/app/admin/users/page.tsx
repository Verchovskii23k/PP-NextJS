"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";
import { toast } from "sonner";
import { InputDialogReset } from "@/components/ui/InputDialogReset";
import { PageSkeleton } from "@/components/ui/page_skeleton";

export default function UsersPage() {
  const [filterRole, setFilterRole] = useState<"teacher" | "student" | undefined>(undefined);
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.userManagement.getUsers.useQuery({
    role: filterRole,
  });
  


  const updateRoleMut = trpc.userManagement.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Роль обновлена");
      utils.userManagement.getUsers.invalidate();
    },
    onError: (e) => { toast.error(e.message ?? "Ошибка") },
  });

  // Мутации для сброса пароля
  const sendResetCodeMut = trpc.userManagement.sendResetCode.useMutation({
    onError: (e) => {toast.error(e.message)},
  });
  const confirmResetCodeMut = trpc.userManagement.confirmResetCode.useMutation({
    onSuccess: (data) => {
      if (data.newPassword) {
        toast.success(`Новый пароль: ${data.newPassword}`);
      } else if (data.message) {
        toast.success(data.message);
      }
      utils.userManagement.getUsers.invalidate();
    },
    onError: (e) => {toast.error(e.message)},
  });

  const [resetDialog, setResetDialog] = useState<{
  userId: string;
  email: string;
  open: boolean;
} | null>(null);

  const handleRoleChange = (userId: string, newRole: "teacher" | "student") => {
    updateRoleMut.mutate({ userId, newRole });
  };
  if (isLoading) return <PageSkeleton />;
  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto bg-background p-6 text-foreground">
      <h1 className="mb-6 text-2xl font-bold">Управление пользователями</h1>

      {/* Фильтр */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Роль:</label>
        <select
          value={filterRole ?? ""}
          onChange={(e) =>
            setFilterRole(
              e.target.value === "teacher" || e.target.value === "student"
                ? e.target.value
                : undefined
            )
          }
          className="rounded border border-border bg-background px-3 py-1 text-sm"
        >
          <option value="">Все</option>
          <option value="teacher">Преподаватель</option>
          <option value="student">Студент</option>
        </select>
      </div>

      {isLoading && <p className="text-muted-foreground">Загрузка...</p>}
      {error && <p className="text-red-500">Ошибка: {error.message}</p>}

      {data && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4">ФИО / Email</th>
                <th className="py-2 pr-4">Email (логин)</th>
                <th className="py-2 pr-4">Роль</th>
                <th className="py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-b border-border">
                  <td className="py-2 pr-4">
                    {u.fullName}
                    {u.isSelf && (
                      <span className="ml-1 text-xs text-muted-foreground">(вы)</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{u.role}</td>
                  <td className="flex items-center gap-2 py-2">
                    {u.role !== "admin" && !u.isSelf && (
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u.id, e.target.value as "teacher" | "student")
                        }
                        disabled={updateRoleMut.isPending}
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="student">Студент</option>
                        <option value="teacher">Преподаватель</option>
                      </select>
                    )}
                    {(u.role === "admin" || u.isSelf) && (
                      <span className="text-xs text-muted-foreground">
                        {u.isSelf ? "Нельзя изменить себе" : "Недоступно"}
                      </span>
                    )}
                    {/* Кнопка сброса пароля */}
                    {!u.isSelf && u.email && (
                      <button
                        onClick={() => {
                          sendResetCodeMut.mutate({ userId: u.id }, {
                            onSuccess: () => {
                              setResetDialog({ userId: u.id, email: u.email!, open: true });
                            },
                          });
                        }}
                        disabled={sendResetCodeMut.isPending}
                        className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Сбросить пароль
                      </button>
                    )}
                    {!u.isSelf && !u.email && (
                      <span className="text-xs text-muted-foreground">Нет email</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Диалог ввода кода */}
      {resetDialog && (
        <InputDialogReset
          open={resetDialog.open}
          title="Введите код сброса"
          placeholder="Трёхзначный код"
          confirmLabel="Подтвердить"
          cancelLabel="Отмена"
          onConfirm={(code) => {
            if (code) {
              confirmResetCodeMut.mutate({ userId: resetDialog.userId, code });
            }
            setResetDialog(null);
          }}
          onCancel={() => setResetDialog(null)}
        />
      )}
    </div>
  );
}