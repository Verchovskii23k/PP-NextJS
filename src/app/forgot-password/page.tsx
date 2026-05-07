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

  const forgotMut = trpc.auth.forgotPassword.useMutation({
    onSuccess: (data) => {
      if ((data as any).message) {
        setMessage((data as any).message);
      } else if ((data as any).token) {
        setToken((data as any).token);
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
    <div className="max-w-md mx-auto mt-20 p-6 border border-border rounded-lg bg-background text-foreground">
      <h1 className="text-xl font-semibold mb-4">Восстановление пароля</h1>

      {message && (
        <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 p-4 rounded mb-4">
          {message}
        </div>
      )}
      {token && (
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 p-4 rounded mb-4">
          <p className="mb-2">Ваш токен восстановления:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background border border-border rounded px-3 py-2 font-mono text-sm break-all">
              {token}
            </div>
            <button
              onClick={copyToken}
              className="p-2 rounded bg-background border border-border hover:bg-muted transition-colors"
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
            className="border border-border rounded px-3 py-2 w-full mb-3 bg-background text-foreground"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
          <label className="text-sm text-muted-foreground">Email</label>
          <input
            className="border border-border rounded px-3 py-2 w-full mb-3 bg-background text-foreground"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="text-red-500 mb-3">{error}</p>}
          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded"
            disabled={forgotMut.isPending}
          >
            {forgotMut.isPending ? "Отправка..." : "Получить инструкцию"}
          </button>
        </form>
      )}

      <p className="mt-4 text-sm text-muted-foreground text-center">
        <Link href="/login" className="hover:underline">← Вернуться ко входу</Link>
      </p>
    </div>
  );
}