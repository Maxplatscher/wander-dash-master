import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { applySavedAppearance } from "@/lib/appearance";
import "./index.css";

try {
  applySavedAppearance();
} catch {
  // localStorage kann in privaten Fenstern fehlen
}

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(<App />);
