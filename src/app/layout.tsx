import { TRPCProvider } from "@/trpc/provider";
import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}