"use client";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "@/trpc/provider";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";
import { Home, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";

function HeaderContent() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname.startsWith("/login");
  const isSetupPage = pathname.startsWith("/setup");
  const isPublicPage = isLoginPage || isSetupPage;

  const { data: user } = trpc.auth.me.useQuery();
  const logoutMut = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.push("/login");
    },
  });

  return (
    <header className="border-b border-border bg-muted">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-12">
        {/* Кнопка домой (скрыта на публичных страницах) */}
        {!isPublicPage && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
            aria-label="На главную"
          >
            <Home size={20} />
            <span className="text-sm font-medium hidden sm:inline">Главная</span>
          </Link>
        )}
        {isPublicPage && <div />}

        {/* Правая группа: тема + выход (выход только если авторизованы и не на публичной странице) */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isPublicPage && user && (
            <button
              onClick={() => logoutMut.mutate()}
              disabled={logoutMut.isPending}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Выйти"
            >
              <LogOut size={20} />
              <span className="text-sm font-medium hidden sm:inline">Выйти</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TRPCProvider>
        <HeaderContent />
        <main className="min-h-screen bg-background text-foreground">
          {children}
        </main>
      </TRPCProvider>
    </ThemeProvider>
  );
}