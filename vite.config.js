import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const compat = (file) => path.resolve(rootDir, "./src/supabase/compat", file)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      // Redirect Firebase SDK imports to the Supabase compatibility layer so the
      // existing application code keeps working unchanged.
      "firebase/firestore": compat("firestore.js"),
      "firebase/auth": compat("auth.js"),
      "firebase/functions": compat("functions.js"),
      "firebase/app": compat("app.js"),
      "firebase/storage": compat("storage.js"),
      "firebase/analytics": compat("analytics.js"),
    },
  },
})
