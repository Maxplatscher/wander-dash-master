import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applySavedAppearance } from "@/lib/appearance";
import "./index.css";

try {
  applySavedAppearance();
} catch {
  // localStorage kann in privaten Fenstern fehlen
}

createRoot(document.getElementById("root")!).render(<App />);
