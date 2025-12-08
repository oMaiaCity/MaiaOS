import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [sveltekit()],
  // Load env vars from current directory (Docker: /app, local: services/me)
  envDir: process.env.NODE_ENV === "production" ? "." : resolve(__dirname, "../.."),
  envPrefix: ["PUBLIC_"],
  resolve: {
    // Ensure proper module resolution in monorepo
    preserveSymlinks: false,
    alias: {
      // In Docker: /app/libs/hominio-brand/src, in local dev: ../../libs/hominio-brand/src
      "@hominio/brand": resolve(__dirname, process.env.NODE_ENV === "production" ? "./libs/hominio-brand/src" : "../../libs/hominio-brand/src"),
    },
  },
  server: {
    port: 4200,
    strictPort: true, // Fail if port is already in use
    fs: {
      // Allow access to workspace packages and monorepo root
      allow: ["..", "../..", "../../libs"],
    },
  },
});
