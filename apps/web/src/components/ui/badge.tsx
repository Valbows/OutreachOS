import { type HTMLAttributes, forwardRef } from "react";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "error" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-primary/15 text-primary",
  secondary: "bg-surface-container-highest text-on-surface-variant",
  success: "bg-secondary/15 text-secondary",
  warning: "bg-tertiary/15 text-tertiary",
  error: "bg-error/15 text-error",
  outline: "border border-outline-variant/30 text-on-surface-variant",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-[var(--radius-chip)] ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
