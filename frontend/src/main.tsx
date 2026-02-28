import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Ion } from "cesium";
import App from "./App.tsx";

// CRITICAL: Must set Ion token before any Resium component mounts
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? "";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
