"use client";
import { trpc } from "@/trpc/client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
    return <div className="p-6 text-foreground">Загрузка...</div>;
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
    <div className="p-6 max-w-lg mx-auto bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6">Настройки аккаунта</h1>

      {/* Смена логина */}
      <div className="bg-background border border-border rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Сменить логин</h2>
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
              className="border border-border rounded px-3 py-2 w-full bg-background text-foreground pr-10"
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
            <p className="text-red-500 text-sm mb-2">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={changeLoginMut.isPending}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {changeLoginMut.isPending ? "Сохранение..." : "Сохранить"}
          </button>
        </form>
      </div>

      {/* Смена пароля */}
      <div className="bg-background border border-border rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">Сменить пароль</h2>
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
              className="border border-border rounded px-3 py-2 w-full bg-background text-foreground pr-10"
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
              className="border border-border rounded px-3 py-2 w-full bg-background text-foreground pr-10"
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
            <p className="text-red-500 text-sm mb-2">{passwordError}</p>
          )}
          <button
            type="submit"
            disabled={changePasswordMut.isPending}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {changePasswordMut.isPending ? "Сохранение..." : "Сменить пароль"}
          </button>
        </form>
      </div>
    </div>
  );
}