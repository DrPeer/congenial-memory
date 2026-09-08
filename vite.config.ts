import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: {
    // `npm run mobile:live` points phones (and sandbox/preview proxies) at this
    // dev server over the network, so don't restrict it to localhost hostnames.
    // Dev-only setting; `vite build` output is unaffected.
    allowedHosts: true,
  },
  preview: {
    // same reason for `vite preview` (the phone-testable production build)
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
