import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Reliability safety net for the editor.
 *
 * Two failure classes used to vanish silently:
 *  1. A render-time exception anywhere in the app tree unmounted everything,
 *     leaving a blank white screen with no message or recovery.
 *  2. An unhandled promise rejection or uncaught error in an event handler
 *     (e.g. a failed fetch behind a button) produced no user-visible signal.
 *
 * `AppErrorBoundary` converts (1) into a visible, recoverable error screen.
 * `installGlobalErrorSurface` converts (2) into a dismissible banner so no
 * failure is silent.
 */

type BoundaryProps = { children: ReactNode };
type BoundaryState = { error: Error | null };

export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep a console trail for debugging in addition to the visible UI.
    console.error("[flux-editor] render crash:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" style={overlayStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>The editor hit an unexpected error</h1>
          <p style={bodyStyle}>
            This is a bug, not your document. Your last saved file is untouched.
          </p>
          <pre style={preStyle}>{error.message || String(error)}</pre>
          <div style={actionsStyle}>
            <button type="button" style={buttonStyle} onClick={this.handleReload}>
              Reload editor
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Register global handlers for unhandled rejections and uncaught errors,
 * surfacing them as a dismissible banner. Returns a disposer. Idempotent: a
 * second call is a no-op while the first is still installed.
 */
let installed = false;
export function installGlobalErrorSurface(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;

  const onRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    showBanner(`Unhandled error: ${message}`);
    console.error("[flux-editor] unhandled rejection:", reason);
  };

  const onError = (event: ErrorEvent): void => {
    // Ignore ResizeObserver noise and benign cross-origin script errors.
    if (!event.message || event.message.includes("ResizeObserver")) return;
    showBanner(`Error: ${event.message}`);
  };

  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("error", onError);

  return () => {
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onError);
    installed = false;
  };
}

const BANNER_ID = "flux-global-error-banner";

function showBanner(message: string): void {
  if (typeof document === "undefined") return;
  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = BANNER_ID;
    Object.assign(banner.style, bannerStyle);

    const dismiss = document.createElement("button");
    dismiss.textContent = "Dismiss";
    Object.assign(dismiss.style, bannerDismissStyle);
    dismiss.addEventListener("click", () => banner?.remove());

    const text = document.createElement("span");
    text.id = `${BANNER_ID}-text`;
    banner.appendChild(text);
    banner.appendChild(dismiss);
    document.body.appendChild(banner);
  }
  const text = document.getElementById(`${BANNER_ID}-text`);
  if (text) text.textContent = message;
}

const overlayStyle = {
  position: "fixed",
  inset: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#1d1b17",
  padding: "24px",
  zIndex: 99999,
} as const;

const cardStyle = {
  maxWidth: "560px",
  width: "100%",
  background: "#fffaf2",
  color: "#1d1b17",
  borderRadius: "12px",
  padding: "28px 32px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
  fontFamily: "Inter, system-ui, sans-serif",
} as const;

const titleStyle = { margin: "0 0 8px", fontSize: "18px", fontWeight: 600 } as const;
const bodyStyle = { margin: "0 0 16px", fontSize: "14px", color: "#6b645a" } as const;
const preStyle = {
  margin: "0 0 20px",
  padding: "12px 14px",
  background: "#f2ece1",
  borderRadius: "8px",
  fontSize: "12px",
  whiteSpace: "pre-wrap",
  overflowX: "auto",
} as const;
const actionsStyle = { display: "flex", justifyContent: "flex-end" } as const;
const buttonStyle = {
  appearance: "none",
  border: "none",
  borderRadius: "8px",
  padding: "10px 18px",
  background: "#2b4c7e",
  color: "#fff",
  fontSize: "14px",
  cursor: "pointer",
} as const;

const bannerStyle = {
  position: "fixed",
  left: "0",
  right: "0",
  bottom: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "10px 16px",
  background: "#7a1f1f",
  color: "#fff",
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: "13px",
  zIndex: 99998,
} as const;

const bannerDismissStyle = {
  appearance: "none",
  border: "1px solid rgba(255,255,255,0.5)",
  borderRadius: "6px",
  background: "transparent",
  color: "#fff",
  padding: "4px 10px",
  fontSize: "12px",
  cursor: "pointer",
} as const;
