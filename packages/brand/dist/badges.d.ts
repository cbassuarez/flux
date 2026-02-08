import { type ReactNode } from "react";
import { type BadgeKind, type BadgeReleaseChannel, type BadgeSize, type BadgeTheme } from "./badge-shared.js";
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
export declare function Badge({ kind, size, theme, label, value, icon, href, onClick, className, title, ariaLabel, }: BadgeProps): import("react/jsx-runtime").JSX.Element;
type BaseWrapperProps = Omit<BadgeProps, "kind" | "label" | "value" | "href">;
export type NpmBadgeProps = BaseWrapperProps & {
    packageName: string;
    version?: string;
    label?: string;
    value?: string;
    href?: string;
};
export declare function NpmBadge({ packageName, version, label, value, href, ...rest }: NpmBadgeProps): import("react/jsx-runtime").JSX.Element;
export type ChannelBadgeProps = BaseWrapperProps & {
    channel: BadgeReleaseChannel;
    packageName?: string;
    version?: string;
    label?: string;
    value?: string;
    href?: string;
};
export declare function ChannelBadge({ channel, packageName, version, label, value, href, ...rest }: ChannelBadgeProps): import("react/jsx-runtime").JSX.Element;
export type CiStatus = "passing" | "failing" | "cancelled" | "running" | "unknown";
export type CiBadgeProps = BaseWrapperProps & {
    status?: CiStatus | string;
    label?: string;
    value?: string;
    repo?: string;
    workflowFile?: string;
    href?: string;
};
export declare function CiBadge({ status, label, value, repo, workflowFile, href, ...rest }: CiBadgeProps): import("react/jsx-runtime").JSX.Element;
export type LicenseBadgeProps = BaseWrapperProps & {
    license?: string;
    label?: string;
    value?: string;
    repo?: string;
    defaultBranch?: string;
    href?: string;
};
export declare function LicenseBadge({ license, label, value, repo, defaultBranch, href, ...rest }: LicenseBadgeProps): import("react/jsx-runtime").JSX.Element;
export type DocsBadgeProps = BaseWrapperProps & {
    label?: string;
    value?: string;
    href?: string;
};
export declare function DocsBadge({ label, value, href, ...rest }: DocsBadgeProps): import("react/jsx-runtime").JSX.Element;
export type DiscordBadgeProps = BaseWrapperProps & {
    label?: string;
    value?: string;
    href?: string;
};
export declare function DiscordBadge({ label, value, href, ...rest }: DiscordBadgeProps): import("react/jsx-runtime").JSX.Element;
export type SecurityBadgeProps = BaseWrapperProps & {
    label?: string;
    value?: string;
    repo?: string;
    href?: string;
};
export declare function SecurityBadge({ label, value, repo, href, ...rest }: SecurityBadgeProps): import("react/jsx-runtime").JSX.Element;
export type MaintainedBadgeProps = BaseWrapperProps & {
    maintained?: boolean;
    label?: string;
    value?: string;
    href?: string;
};
export declare function MaintainedBadge({ maintained, label, value, href, ...rest }: MaintainedBadgeProps): import("react/jsx-runtime").JSX.Element;
export declare function fallbackBadgeValue(value: string | undefined): string;
export {};
//# sourceMappingURL=badges.d.ts.map