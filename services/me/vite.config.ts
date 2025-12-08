import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [sveltekit()],
  // Load env vars from monorepo root
  envDir: resolve(__dirname, "../.."),
  envPrefix: ["PUBLIC_"],
  resolve: {
    // Ensure proper module resolution in monorepo
    preserveSymlinks: false,
    alias: {
      // Ensure workspace packages resolve correctly during build
      "@hominio/brand": resolve(__dirname, "../../libs/hominio-brand/src"),
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
