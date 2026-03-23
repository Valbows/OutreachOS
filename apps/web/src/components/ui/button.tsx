import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-primary text-on-primary-fixed font-semibold hover:opacity-90 active:opacity-80",
  secondary:
    "bg-transparent border border-outline/20 text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest",
  ghost:
    "bg-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
  danger:
    "bg-error-container text-on-error-container font-semibold hover:opacity-90",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-[var(--radius-button)]",
  md: "px-4 py-2 text-sm rounded-[var(--radius-button)]",
  lg: "px-6 py-3 text-base rounded-[var(--radius-button)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
