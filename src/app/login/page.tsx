"use client";
import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loginMut = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/admin";
    },
    onError: (e) => setError(e.message),
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      setLogin(""); // убедимся, что поле логина чистое
    }, 100); // 100 мс обычно достаточно
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto mt-20 max-w-md rounded-lg border border-border bg-background p-6 text-foreground">
      <h1 className="mb-4 text-xl font-semibold">Вход</h1>
      {error && <p className="mb-4 text-red-500">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loginMut.mutate({ login, password });
        }}
      >
        <input
          className="mb-3 w-full rounded border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
          placeholder="Логин"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="off"
        />
        <div className="relative mb-4">
          <input
            className="w-full rounded border border-border bg-background px-3 py-2 pr-10 text-foreground placeholder:text-muted-foreground"
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
          className="hover:bg-primary/90 w-full rounded bg-primary px-4 py-2 font-medium text-white transition-colors"
          type="submit"
          disabled={loginMut.isPending}
        >
          {loginMut.isPending ? "Вход..." : "Войти"}
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="hover:underline">
            Забыли пароль?
          </Link>
        </p>
      </form>
    </div>
  );
}