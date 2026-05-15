import type { NextConfig } from "next";
import { config } from "dotenv";

// Загружаем .env.test только в development/test окружении
if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.test" });
}

const nextConfig: NextConfig = {
  /* ваши настройки */
};

export default nextConfig;
