import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppErrorBoundary, installGlobalErrorSurface } from "./errorSurface";
import "./index.css";
import "./styles/branding.css";

const baseUrl = import.meta.env.BASE_URL;
const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
const routerBase = trimmedBase || "/";

// Surface unhandled rejections / uncaught errors instead of failing silently.
installGlobalErrorSurface();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter basename={routerBase}>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
