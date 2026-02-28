import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";

const cesiumSource = "node_modules/cesium/Build/Cesium";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/Workers`, dest: "cesiumStatic" },
        { src: `${cesiumSource}/Assets`, dest: "cesiumStatic" },
        { src: `${cesiumSource}/Widgets`, dest: "cesiumStatic" },
        { src: `${cesiumSource}/ThirdParty`, dest: "cesiumStatic" },
      ],
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesiumStatic"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
});
