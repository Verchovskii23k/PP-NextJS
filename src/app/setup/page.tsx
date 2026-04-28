"use client";
import { useState } from "react";
import { trpc } from "@/trpc/client";

export default function SetupPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const setupMutation = trpc.auth.setup.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.message),
  });

  if (done) return <div className="p-8">Первый администратор создан. <a href="/login">Войти</a></div>;

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded">
      <h1 className="text-xl mb-4">Первоначальная настройка</h1>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); setError(""); setupMutation.mutate({ login, password }); }}>
        <input className="border p-2 w-full mb-2" placeholder="Логин" value={login} onChange={e => setLogin(e.target.value)} />
        <input className="border p-2 w-full mb-4" type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="bg-blue-500 text-white p-2 w-full" type="submit" disabled={setupMutation.isPending}>
          {setupMutation.isPending ? "Создание..." : "Создать администратора"}
        </button>
      </form>
    </div>
  );
}