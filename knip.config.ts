import type { KnipConfig } from "knip";

const config: KnipConfig = {
  // Зависимости, которые knip не видит через статический анализ
  ignoreDependencies: [
    // Тестовые утилиты
    "@vitest/coverage-v8",
    "dotenv-cli",
    // Утилиты разработки
    "@waldzellai/clear-thought",
    // Зависимости, которые используются динамически или через side-effects
    "prom-client",
    "winston",
    "winston-daily-rotate-file",
    "zod",
    // Типы — нужны для TypeScript, не видны в рантайме
    "@types/bcryptjs",
    "@types/express-rate-limit",
    "@types/react-window",
  ],

  // Файлы, которые не являются частью приложения
  ignore: [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/*.d.ts",
    // Конфиги, которые загружаются неявно
    "frontend/tailwind.config.js",
    "frontend/postcss.config.js",
    "frontend/vite.config.ts",
    // Unused files (пока не удалены)
    "frontend/src/pages/AuctionDetails/components/AuctionStatus.tsx",
    "frontend/src/utils/validation/auction.schema.ts",
    "backend/src/errors/index.ts",
    "backend/src/utils/json.ts",
  ],

  workspaces: {
    // Бэкенд
    backend: {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
    },

    // Фронтенд
    frontend: {
      entry: ["src/main.tsx"],
      project: ["src/**/*.{ts,tsx}"],
    },
  },
};

export default config;
