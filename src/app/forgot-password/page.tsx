"use client";
import { useState } from "react";
import { trpc } from "@/trpc/client";
import Link from "next/link";
import { Copy, Check } from "lucide-react";

export default function ForgotPasswordPage() {
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  interface ForgotPasswordResult {
    message?: string;
    token?: string;
  }

  const forgotMut = trpc.auth.forgotPassword.useMutation({
    onSuccess: (data: ForgotPasswordResult) => {
      if (data.message) {
        setMessage(data.message);
      } else if (data.token) {
        setToken(data.token);
      }
    },
    onError: (e) => setError(e.message),
  });

  const copyToken = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md rounded-lg border border-border bg-background p-6 text-foreground">
      <h1 className="mb-4 text-xl font-semibold">Восстановление пароля</h1>

      {message && (
        <div className="mb-4 rounded border border-green-400 bg-green-100 p-4 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          {message}
        </div>
      )}
      {token && (
        <div className="mb-4 rounded border border-yellow-400 bg-yellow-100 p-4 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          <p className="mb-2">Ваш токен восстановления:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 break-all rounded border border-border bg-background px-3 py-2 font-mono text-sm">
              {token}
            </div>
            <button
              onClick={copyToken}
              className="rounded border border-border bg-background p-2 transition-colors hover:bg-muted"
              title="Копировать токен"
            >
              {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>
          </div>
          <p className="mt-2">
            <Link href="/reset-password" className="text-primary hover:underline">
              Перейти к сбросу пароля
            </Link>
          </p>
        </div>
      )}

      {!message && !token && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            forgotMut.mutate({ login: login || undefined, email: email || undefined });
          }}
        >
          <label className="text-sm text-muted-foreground">Логин</label>
          <input
            className="mb-3 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
          <label className="text-sm text-muted-foreground">Email</label>
          <input
            className="mb-3 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="mb-3 text-red-500">{error}</p>}
          <button
            type="submit"
            className="hover:bg-primary/90 w-full rounded bg-primary px-4 py-2 font-medium text-white"
            disabled={forgotMut.isPending}
          >
            {forgotMut.isPending ? "Отправка..." : "Получить инструкцию"}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:underline">← Вернуться ко входу</Link>
      </p>
    </div>
  );
}