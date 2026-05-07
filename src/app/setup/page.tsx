"use client";
import { useState } from "react";
import { trpc } from "@/trpc/client";
import { CheckCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function SetupPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const setupMutation = trpc.auth.setup.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.message),
  });

  if (done) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="bg-background border border-border rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle size={48} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Готово!</h2>
          <p className="text-muted-foreground mb-6">
            Первый администратор успешно создан. Теперь вы можете войти в систему.
          </p>
          <Link
            href="/login"
            className="inline-block w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border border-border rounded-lg bg-background text-foreground">
      <h1 className="text-xl font-semibold mb-4">Первоначальная настройка</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setupMutation.mutate({ login, password });
        }}
      >
        <input
          className="border border-border rounded px-3 py-2 w-full mb-3 bg-background text-foreground placeholder:text-muted-foreground"
          placeholder="Логин"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <div className="relative mb-4">
          <input
            className="border border-border rounded px-3 py-2 w-full bg-background text-foreground placeholder:text-muted-foreground pr-10"
            type={showPassword ? "text" : "password"}
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Показать пароль"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <button
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded transition-colors"
          type="submit"
          disabled={setupMutation.isPending}
        >
          {setupMutation.isPending ? "Создание..." : "Создать администратора"}
        </button>
      </form>
    </div>
  );
}