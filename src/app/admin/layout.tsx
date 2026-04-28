"use client";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: me, isLoading } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (!isLoading && (!me || me.role !== "admin")) {
      router.replace("/login");
    }
  }, [me, isLoading, router]);

  if (isLoading) return <div className="p-8">Проверка доступа...</div>;
  if (!me || me.role !== "admin") return null;

  return <>{children}</>;
}