import { defineConfig } from "prisma/config";
import path from "path";

// Node 20.12+ built-in: load .env before Prisma evaluates this config
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // .env file not found — OK in production/CI where env vars are set externally
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
