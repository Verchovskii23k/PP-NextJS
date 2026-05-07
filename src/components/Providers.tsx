"use client";
import { ThemeProvider } from "next-themes";
import { TRPCProvider } from "@/trpc/provider";
import ThemeToggle from "./ThemeToggle";
import Link from "next/link";
import { Home } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname.startsWith("/login");

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TRPCProvider>
        <header className="border-b border-border bg-muted">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-12">
            {/* Кнопка домой видна только не на странице логина */}
            {!isLoginPage && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                aria-label="На главную"
              >
                <Home size={20} />
                <span className="text-sm font-medium hidden sm:inline">Главная</span>
              </Link>
            )}
            {/* Если на странице логина — просто оставляем пустой div для сохранения justify-between */}
            {isLoginPage && <div />}

            {/* Переключатель темы всегда справа */}
            <ThemeToggle />
          </div>
        </header>
        <main className="min-h-screen bg-background text-foreground">
          {children}
        </main>
      </TRPCProvider>
    </ThemeProvider>
  );
}