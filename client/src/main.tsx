import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registered, scope:", reg.scope);
        reg.addEventListener("updatefound", () => {
          const incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener("statechange", () => {
            if (incoming.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[SW] Update available — refresh to activate");
            }
          });
        });
      })
      .catch((err) => console.warn("[SW] Registration failed:", err));
  });
}

// Global error handlers: suppress and log errors originating from external script files to avoid app crashes
window.addEventListener("error", (event) => {
  try {
    const filename = (event as ErrorEvent).filename || "";
    const isExternal = filename && !filename.startsWith(window.location.origin) && /^https?:\/\//.test(filename);
    if (isExternal) {
      // Prevent default browser logging for noisy external script errors, but surface a concise warning
      console.warn("Suppressed external script error from:", filename, "message:", event.message);
      event.preventDefault();
    }
  } catch (e) {
    // ignore
  }
});

window.addEventListener("unhandledrejection", (ev) => {
  try {
    const reason = ev.reason as any;
    const isExternal = reason && typeof reason === "object" && /https?:\/\//.test(String(reason?.stack || reason?.fileName || ""));
    if (isExternal) {
      console.warn("Suppressed external script promise rejection:", reason);
      ev.preventDefault();
    }
  } catch (e) {
    // ignore
  }
});

createRoot(document.getElementById("root")!).render(<App />);
