import path from "path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Integrationstests laufen gegen die echte Remote-Supabase-Instanz und brauchen
// deshalb auch Variablen ohne VITE_-Präfix. Das leere Präfix lädt alles aus
// .env / .env.test (beide gitignored) in process.env des Testlaufs.
const env = loadEnv("test", process.cwd(), "");

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.integration.test.ts"],
    env,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Netzwerktests schreiben gemeinsame Testdaten – nie parallel ausführen.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
