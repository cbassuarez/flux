import { type CSSProperties, type KeyboardEvent, type MouseEvent, useId } from "react";
import { FLUX_TAGLINE, coerceVersionInfo, formatFluxVersion, type FluxVersionInfo } from "./index.js";

export const FLUX_MARK_FAVICON_PATH = "/flux-mark-favicon.svg";

export type FluxMarkProps = {
  size?: number;
  markPath?: string;
  className?: string;
  title?: string;
  testId?: string;
};

export function FluxMark({
  size = 18,
  markPath = FLUX_MARK_FAVICON_PATH,
  className,
  title = "Flux mark",
  testId = "flux-mark",
}: FluxMarkProps) {
  const maskId = useId().replace(/:/g, "");

  return (
    <svg
      role="img"
      aria-label={title}
      data-testid={testId}
      className={joinClassName("flux-brand-mark", className)}
      viewBox="0 0 360 360"
      width={size}
      height={size}
      style={{ display: "block", color: "inherit", flexShrink: 0 }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="360" height="360">
          <rect x="0" y="0" width="360" height="360" fill="black" />
          <image href={markPath} x="0" y="0" width="360" height="360" preserveAspectRatio="xMidYMid meet" />
        </mask>
      </defs>
      <rect x="0" y="0" width="360" height="360" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export type FluxWordmarkProps = {
  className?: string;
};

const WORDMARK_STYLE: CSSProperties = {
  fontFamily: '"IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontStyle: "italic",
  fontWeight: 600,
  fontVariantLigatures: "contextual common-ligatures",
  fontFeatureSettings: '"liga" 1, "calt" 1',
  letterSpacing: "-0.01em",
  lineHeight: 1,
  textTransform: "lowercase",
};

export function FluxWordmark({ className }: FluxWordmarkProps) {
  return (
    <span
      data-testid="flux-wordmark"
      data-flux-ligatures="enabled"
      className={joinClassName("flux-brand-wordmark", className)}
      style={WORDMARK_STYLE}
    >
      flux
    </span>
  );
}

export type FluxBrandHeaderVariant = "menu" | "marketing" | "header";

export type FluxBrandHeaderProps = {
  info: Partial<FluxVersionInfo>;
  variant?: FluxBrandHeaderVariant;
  markPath?: string;
  showTagline?: boolean;
  onVersionClick?: () => void;
  className?: string;
  line1ClassName?: string;
  line2ClassName?: string;
  title?: string;
};

const VARIANT_STYLE: Record<FluxBrandHeaderVariant, { mark: number; line1Size: number; line2Size: number; gap: number }> = {
  menu: { mark: 15, line1Size: 13, line2Size: 11, gap: 6 },
  marketing: { mark: 20, line1Size: 15, line2Size: 12, gap: 8 },
  header: { mark: 18, line1Size: 14, line2Size: 12, gap: 8 },
};

const SR_ONLY_STYLE: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function FluxBrandHeader({
  info,
  variant = "header",
  markPath,
  showTagline = variant !== "menu",
  onVersionClick,
  className,
  line1ClassName,
  line2ClassName,
  title,
}: FluxBrandHeaderProps) {
  const normalized = coerceVersionInfo(info);
  const sizing = VARIANT_STYLE[variant];

  const versionHandlers = onVersionClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onMouseDown: (event: MouseEvent<HTMLSpanElement>) => {
          event.preventDefault();
          event.stopPropagation();
        },
        onClick: (event: MouseEvent<HTMLSpanElement>) => {
          event.preventDefault();
          event.stopPropagation();
          onVersionClick();
        },
        onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          onVersionClick();
        },
      }
    : {};

  return (
    <div
      className={joinClassName("flux-brand-header", className)}
      style={{ display: "inline-flex", flexDirection: "column", gap: 2, lineHeight: 1.1, color: "inherit", position: "relative" }}
      title={title ?? (showTagline ? undefined : FLUX_TAGLINE)}
    >
      <div
        className={joinClassName("flux-brand-line1", line1ClassName)}
        style={{ display: "inline-flex", alignItems: "center", gap: sizing.gap, fontSize: sizing.line1Size }}
      >
        <FluxMark size={sizing.mark} markPath={markPath} />
        <FluxWordmark />
        <span
          data-testid="flux-brand-version"
          className="flux-brand-version"
          style={{
            color: "rgba(80, 92, 116, 0.95)",
            border: "1px solid rgba(133, 146, 173, 0.45)",
            borderRadius: 999,
            padding: "1px 7px",
            fontSize: Math.max(10, sizing.line2Size),
            fontWeight: 500,
            lineHeight: 1.2,
            cursor: onVersionClick ? "pointer" : "default",
          }}
          {...versionHandlers}
        >
          {formatFluxVersion(normalized.version)}
        </span>
      </div>

      {showTagline ? (
        <div
          className={joinClassName("flux-brand-line2", line2ClassName)}
          style={{
            color: "rgba(94, 106, 130, 0.95)",
            fontSize: sizing.line2Size,
            lineHeight: 1.2,
          }}
        >
          {normalized.tagline}
        </div>
      ) : (
        <span className="flux-brand-line2-sr" style={SR_ONLY_STYLE}>
          {normalized.tagline}
        </span>
      )}
    </div>
  );
}

function joinClassName(...values: Array<string | undefined>): string | undefined {
  const joined = values.filter(Boolean).join(" ").trim();
  return joined.length > 0 ? joined : undefined;
}
