import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites under https://<user>.github.io/<repo>/,
// so assets must be requested from that sub-path. Locally (dev/preview) we
// keep the root base. Override with BASE_PATH if you fork/rename the repo.
const base = process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? "/my-financial-planning-sim/" : "/");

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0]);
