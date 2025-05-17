import * as path from "node:path"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"
import dts from "vite-plugin-dts"
import { builtinModules } from "node:module"

export default defineConfig({
  publicDir: false,
  plugins: [
    tsconfigPaths(),
    dts({
      entryRoot: "src",
      outDir: "dist",
      exclude: ["specs/**"]
    })
  ],
  build: {
    target: "node24",
    minify: true,
    lib: {
      entry: {
        "pathfinder": path.resolve(__dirname, "src/index.ts"),
      },
      name: "pathfinder",
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: [...builtinModules, "joi", "express", "cors"],
      output: { exports: "named" }
    },
    commonjsOptions: { transformMixedEsModules: true },
    ssr: true
  }
})