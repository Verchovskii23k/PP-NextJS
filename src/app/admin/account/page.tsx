"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountPage() {
  // Проверка авторизации
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Смена логина
  const [newLogin, setNewLogin] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const changeLoginMut = trpc.auth.changeLogin.useMutation({
    onSuccess: () => {
      setNewLogin("");
      setLoginError(null);
      toast("Логин успешно изменён");
    },
    onError: (e) => setLoginError(e.message),
  });

  // Смена пароля
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const changePasswordMut = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordError(null);
      toast("Пароль успешно изменён");
    },
    onError: (e) => setPasswordError(e.message),
  });

  // Пока загружается информация о пользователе – показываем лоадер
  if (userLoading) {
      return (
        <div className="space-y-2 p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      );
  }

  // Если пользователь не авторизован – предлагаем войти
  if (!user) {
    return (
      <div className="p-6 text-center text-foreground">
        <p>Вы не авторизованы.</p>
        <Link href="/login" className="text-primary hover:underline">
          Войти
        </Link>
      </div>
    );
  }

  // Основной интерфейс (только для авторизованных)
  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto bg-background p-6 text-foreground">
      <h1 className="mb-6 text-2xl font-bold">Настройки аккаунта</h1>

      {/* Смена логина */}
      <div className="mb-6 rounded-lg border border-border bg-background p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Сменить логин</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            changeLoginMut.mutate({ newLogin });
          }}
        >
          <label className="text-sm text-muted-foreground">Новый логин</label>
          <div className="relative mb-2">
            <input
              type={showLogin ? "text" : "password"}
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 pr-10 text-foreground"
              required
            />
            <button
              type="button"
              onClick={() => setShowLogin(!showLogin)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Показать логин"
            >
              {showLogin ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {loginError && (
            <p className="mb-2 text-sm text-red-500">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={changeLoginMut.isPending}
            className="hover:bg-primary/90 rounded bg-primary px-4 py-2 text-white disabled:opacity-50"
          >
            {changeLoginMut.isPending ? "Сохранение..." : "Сохранить"}
          </button>
        </form>
      </div>

      {/* Смена пароля */}
      <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Сменить пароль</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            changePasswordMut.mutate({ currentPassword, newPassword });
          }}
        >
          <label className="text-sm text-muted-foreground">Текущий пароль</label>
          <div className="relative mb-2">
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 pr-10 text-foreground"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Показать текущий пароль"
            >
              {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <label className="text-sm text-muted-foreground">Новый пароль (мин. 6 символов)</label>
          <div className="relative mb-2">
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 pr-10 text-foreground"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Показать новый пароль"
            >
              {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {passwordError && (
            <p className="mb-2 text-sm text-red-500">{passwordError}</p>
          )}
          <button
            type="submit"
            disabled={changePasswordMut.isPending}
            className="hover:bg-primary/90 rounded bg-primary px-4 py-2 text-white disabled:opacity-50"
          >
            {changePasswordMut.isPending ? "Сохранение..." : "Сменить пароль"}
          </button>
        </form>
      </div>
    </div>
  );
}