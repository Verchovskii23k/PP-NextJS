"use client";
import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";   // ← добавить для ссылки навигации

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const loginMut = trpc.auth.login.useMutation({
    onSuccess: () => router.push("/admin"),
    onError: (e) => setError(e.message),
  });

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border border-border rounded-lg bg-background text-foreground">
      <h1 className="text-xl font-semibold mb-4">Вход</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loginMut.mutate({ login, password });
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
          disabled={loginMut.isPending}
        >
          {loginMut.isPending ? "Вход..." : "Войти"}
        </button>
        <p className="mt-4 text-sm text-center text-muted-foreground">
        <Link href="/forgot-password" className="hover:underline">
          Забыли пароль?
        </Link>
      </p>
      </form>
    </div>
  );
}