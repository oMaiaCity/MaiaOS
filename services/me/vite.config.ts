import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      "@hominio/brand": resolve(__dirname, "../../libs/hominio-brand/src"),
    },
  },
  server: {
    port: 4200,
    strictPort: true, // Fail if port is already in use
  },
});
