import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "editor-button--primary",
  secondary: "editor-button--secondary",
  ghost: "editor-button--ghost",
  danger: "editor-button--danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "editor-button--sm",
  md: "editor-button--md",
  lg: "editor-button--lg",
};

function cn(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(" ");
}

export function Button({ variant = "secondary", size = "md", iconOnly, className, type, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn("editor-button", variantClasses[variant], sizeClasses[size], iconOnly && "editor-button--icon", className)}
      {...props}
    />
  );
}
