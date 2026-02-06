import type { CSSProperties, ReactNode } from "react";

export function EditorFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`editor-shell${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function EditorToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header className={`editor-toolbar${className ? ` ${className}` : ""}`} role="toolbar">
      {children}
    </header>
  );
}

export function OutlinePane({ children, className, style }: PaneProps) {
  return (
    <aside className={`outline-pane${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </aside>
  );
}

export function PageStage({ children, className, style }: PaneProps) {
  return (
    <section className={`page-stage${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </section>
  );
}

export function InspectorPane({ children, className, style }: PaneProps) {
  return (
    <aside className={`inspector-pane${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </aside>
  );
}

export function StatusBar({ children, className }: { children: ReactNode; className?: string }) {
  return <footer className={`editor-statusbar${className ? ` ${className}` : ""}`}>{children}</footer>;
}

export function DividerHairline({ orientation = "horizontal" }: { orientation?: "horizontal" | "vertical" }) {
  return <div className={`editor-divider editor-divider-${orientation}`} aria-hidden="true" />;
}

type PaneProps = { children: ReactNode; className?: string; style?: CSSProperties };
