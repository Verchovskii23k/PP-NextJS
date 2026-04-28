"use client";
import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const loginMut = trpc.auth.login.useMutation({
    onSuccess: () => router.push("/admin"),
    onError: (e) => setError(e.message),
  });

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded">
      <h1 className="text-xl mb-4">Вход</h1>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); loginMut.mutate({ login, password }); }}>
        <input className="border p-2 w-full mb-2" placeholder="Логин" value={login} onChange={e => setLogin(e.target.value)} />
        <input className="border p-2 w-full mb-4" type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="bg-blue-500 text-white p-2 w-full" type="submit" disabled={loginMut.isPending}>
          {loginMut.isPending ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}