"use client";
import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";
  const [token, setToken] = useState(initialToken);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const resetMut = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("lastLogin");
      }
      router.push("/login");
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border border-border rounded-lg bg-background text-foreground">
      <h1 className="text-xl font-semibold mb-4">Новый пароль{newLogin ? " и логин" : ""}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          resetMut.mutate({
            token,
            newPassword,
            newLogin: newLogin.trim() || undefined,
          });
        }}
      >
        <label className="text-sm text-muted-foreground">Токен</label>
        <input
          className="border border-border rounded px-3 py-2 w-full mb-3 bg-background text-foreground"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          autoComplete="off"
        />

        <label className="text-sm text-muted-foreground">
          Новый логин (необязательно)
        </label>
        <input
          className="border border-border rounded px-3 py-2 w-full mb-3 bg-background text-foreground"
          value={newLogin}
          onChange={(e) => setNewLogin(e.target.value)}
          placeholder="Оставьте пустым, чтобы не менять"
          autoComplete="off"
          minLength={3}
        />

        <label className="text-sm text-muted-foreground">Новый пароль (мин. 6 символов)</label>
        <div className="relative mb-3">
          <input
            type={showPassword ? "text" : "password"}
            className="border border-border rounded px-3 py-2 w-full bg-background text-foreground pr-10"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {error && <p className="text-red-500 mb-3">{error}</p>}

        <button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded"
          disabled={resetMut.isPending}
        >
          {resetMut.isPending ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
    </div>
  );
}