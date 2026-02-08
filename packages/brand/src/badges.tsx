import { type CSSProperties, type MouseEventHandler, type ReactNode, useMemo, useState } from "react";
import {
  BADGE_ACCENTS,
  BADGE_FALLBACK_VALUE,
  BADGE_SIZE_TOKENS,
  BADGE_THEME_TOKENS,
  formatBadgeVersion,
  normalizeBadgeValue,
  type BadgeKind,
  type BadgeReleaseChannel,
  type BadgeSize,
  type BadgeTheme,
} from "./badge-shared.js";
import { getBadgeIconShapes } from "./badge-icons.js";

export type BadgeProps = {
  kind: BadgeKind;
  size?: BadgeSize;
  theme?: BadgeTheme;
  label: string;
  value?: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  title?: string;
  ariaLabel?: string;
};

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith("#") || (color.length !== 7 && color.length !== 4)) {
    return color;
  }

  const expand = (value: string): string => (value.length === 1 ? value.repeat(2) : value);
  const raw = color.slice(1);
  const r = parseInt(expand(raw.slice(0, raw.length === 3 ? 1 : 2)), 16);
  const gStart = raw.length === 3 ? 1 : 2;
  const g = parseInt(expand(raw.slice(gStart, gStart + (raw.length === 3 ? 1 : 2))), 16);
  const bStart = raw.length === 3 ? 2 : 4;
  const b = parseInt(expand(raw.slice(bStart, bStart + (raw.length === 3 ? 1 : 2))), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function joinClassName(...parts: Array<string | undefined>): string | undefined {
  const value = parts.filter(Boolean).join(" ").trim();
  return value.length > 0 ? value : undefined;
}

function DefaultBadgeIcon({ kind, size, color }: { kind: BadgeKind; size: number; color: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      style={{ display: "block", color }}
    >
      {getBadgeIconShapes(kind).map((shape, index) => {
        const base = {
          fill: shape.fill === "currentColor" ? color : shape.fill ?? "none",
          stroke: shape.stroke === "currentColor" ? color : shape.stroke,
          strokeWidth: shape.strokeWidth,
          strokeLinecap: shape.linecap,
          strokeLinejoin: shape.linejoin,
        } as const;

        if (shape.type === "path") {
          return <path key={`${kind}-${index}`} d={shape.d} {...base} />;
        }

        if (shape.type === "circle") {
          return <circle key={`${kind}-${index}`} cx={shape.cx} cy={shape.cy} r={shape.r} {...base} />;
        }

        return (
          <rect
            key={`${kind}-${index}`}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={shape.rx}
            {...base}
          />
        );
      })}
    </svg>
  );
}

export function Badge({
  kind,
  size = "md",
  theme = "auto",
  label,
  value,
  icon,
  href,
  onClick,
  className,
  title,
  ariaLabel,
}: BadgeProps) {
  const normalizedValue = normalizeBadgeValue(value);
  const isLink = typeof href === "string" && href.length > 0;
  const isButton = !isLink && typeof onClick === "function";
  const interactive = isLink || isButton;

  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const tokens = BADGE_THEME_TOKENS[theme];
  const sizes = BADGE_SIZE_TOKENS[size];
  const accent = BADGE_ACCENTS[kind];
  const elevated = interactive && (isHovered || isFocused);

  const baseStyle = useMemo<CSSProperties>(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      gap: sizes.gap,
      borderRadius: sizes.radius,
      border: `1px solid ${elevated ? withAlpha(accent, 0.6) : tokens.border}`,
      background: tokens.surface,
      color: tokens.text,
      fontSize: sizes.font,
      fontWeight: 600,
      lineHeight: 1.1,
      padding: `${sizes.padY}px ${sizes.padX}px`,
      whiteSpace: "nowrap",
      boxShadow: elevated ? tokens.hoverShadow : tokens.shadow,
      transform: elevated ? "translateY(-1px)" : "translateY(0)",
      transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background-color 140ms ease",
      textDecoration: "none",
      cursor: interactive ? "pointer" : "default",
      userSelect: "none",
      outline: isFocused ? `2px solid ${tokens.ring}` : undefined,
      outlineOffset: 2,
    }),
    [accent, elevated, interactive, isFocused, sizes.font, sizes.gap, sizes.padX, sizes.padY, sizes.radius, tokens],
  );

  const hoverHandlers = interactive
    ? {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        onFocus: () => setIsFocused(true),
        onBlur: () => setIsFocused(false),
      }
    : {};

  const computedAria = ariaLabel ?? `${label}${normalizedValue ? ` ${normalizedValue}` : ""}`;
  const computedTitle = title ?? computedAria;

  const contents = (
    <>
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
        {icon ?? <DefaultBadgeIcon kind={kind} size={sizes.icon} color={accent} />}
      </span>
      <span>{label}</span>
      {normalizedValue ? (
        <>
          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: Math.max(10, sizes.font + 1),
              background: withAlpha(tokens.muted, theme === "dark" ? 0.45 : 0.35),
            }}
          />
          <span style={{ color: tokens.muted, fontSize: sizes.valueFont, fontWeight: 500 }}>{normalizedValue}</span>
        </>
      ) : null}
    </>
  );

  if (isLink) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={joinClassName("flux-brand-badge", className)}
        style={baseStyle}
        aria-label={computedAria}
        title={computedTitle}
        {...hoverHandlers}
      >
        {contents}
      </a>
    );
  }

  if (isButton) {
    return (
      <button
        type="button"
        onClick={onClick as MouseEventHandler<HTMLButtonElement>}
        className={joinClassName("flux-brand-badge", className)}
        style={baseStyle}
        aria-label={computedAria}
        title={computedTitle}
        {...hoverHandlers}
      >
        {contents}
      </button>
    );
  }

  return (
    <span
      className={joinClassName("flux-brand-badge", className)}
      style={baseStyle}
      aria-label={computedAria}
      title={computedTitle}
    >
      {contents}
    </span>
  );
}

type BaseWrapperProps = Omit<BadgeProps, "kind" | "label" | "value" | "href">;

export type NpmBadgeProps = BaseWrapperProps & {
  packageName: string;
  version?: string;
  label?: string;
  value?: string;
  href?: string;
};

export function NpmBadge({ packageName, version, label, value, href, ...rest }: NpmBadgeProps) {
  return (
    <Badge
      kind="npm"
      label={label ?? packageName}
      value={value ?? formatBadgeVersion(version)}
      href={href ?? `https://www.npmjs.com/package/${packageName}`}
      {...rest}
    />
  );
}

export type ChannelBadgeProps = BaseWrapperProps & {
  channel: BadgeReleaseChannel;
  packageName?: string;
  version?: string;
  label?: string;
  value?: string;
  href?: string;
};

export function ChannelBadge({ channel, packageName, version, label, value, href, ...rest }: ChannelBadgeProps) {
  return (
    <Badge
      kind="channel"
      label={label ?? "Channel"}
      value={value ?? formatBadgeVersion(version) ?? channel}
      href={href ?? (packageName ? `https://www.npmjs.com/package/${packageName}` : undefined)}
      {...rest}
    />
  );
}

export type CiStatus = "passing" | "failing" | "cancelled" | "running" | "unknown";

export type CiBadgeProps = BaseWrapperProps & {
  status?: CiStatus | string;
  label?: string;
  value?: string;
  repo?: string;
  workflowFile?: string;
  href?: string;
};

export function CiBadge({ status = "unknown", label, value, repo, workflowFile, href, ...rest }: CiBadgeProps) {
  const workflowHref = repo
    ? workflowFile
      ? `https://github.com/${repo}/actions/workflows/${workflowFile}`
      : `https://github.com/${repo}/actions`
    : undefined;
  return (
    <Badge
      kind="ci"
      label={label ?? "CI"}
      value={value ?? status}
      href={href ?? workflowHref}
      {...rest}
    />
  );
}

export type LicenseBadgeProps = BaseWrapperProps & {
  license?: string;
  label?: string;
  value?: string;
  repo?: string;
  defaultBranch?: string;
  href?: string;
};

export function LicenseBadge({
  license,
  label,
  value,
  repo,
  defaultBranch = "main",
  href,
  ...rest
}: LicenseBadgeProps) {
  return (
    <Badge
      kind="license"
      label={label ?? "License"}
      value={value ?? license ?? "unknown"}
      href={href ?? (repo ? `https://github.com/${repo}/blob/${defaultBranch}/LICENSE` : undefined)}
      {...rest}
    />
  );
}

export type DocsBadgeProps = BaseWrapperProps & {
  label?: string;
  value?: string;
  href?: string;
};

export function DocsBadge({ label, value, href, ...rest }: DocsBadgeProps) {
  return <Badge kind="docs" label={label ?? "Docs"} value={value ?? "site"} href={href ?? "https://flux-lang.org"} {...rest} />;
}

export type DiscordBadgeProps = BaseWrapperProps & {
  label?: string;
  value?: string;
  href?: string;
};

export function DiscordBadge({ label, value, href, ...rest }: DiscordBadgeProps) {
  return (
    <Badge
      kind="discord"
      label={label ?? "Community"}
      value={value ?? "chat"}
      href={href ?? "https://github.com/cbassuarez/flux/discussions"}
      {...rest}
    />
  );
}

export type SecurityBadgeProps = BaseWrapperProps & {
  label?: string;
  value?: string;
  repo?: string;
  href?: string;
};

export function SecurityBadge({ label, value, repo, href, ...rest }: SecurityBadgeProps) {
  return (
    <Badge
      kind="security"
      label={label ?? "Security"}
      value={value ?? "policy"}
      href={href ?? (repo ? `https://github.com/${repo}/security/policy` : undefined)}
      {...rest}
    />
  );
}

export type MaintainedBadgeProps = BaseWrapperProps & {
  maintained?: boolean;
  label?: string;
  value?: string;
  href?: string;
};

export function MaintainedBadge({ maintained = true, label, value, href, ...rest }: MaintainedBadgeProps) {
  return (
    <Badge
      kind="maintained"
      label={label ?? "Maintained"}
      value={value ?? (maintained ? "yes" : "stale")}
      href={href}
      {...rest}
    />
  );
}

export function fallbackBadgeValue(value: string | undefined): string {
  return normalizeBadgeValue(value) ?? BADGE_FALLBACK_VALUE;
}
