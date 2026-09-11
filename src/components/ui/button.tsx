import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "soft" | "white";
  size?: "sm" | "md" | "lg";
  href?: string;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-grad text-white shadow-glow hover:brightness-[1.06] hover:shadow-[0_14px_34px_-10px_rgb(232_76_145_/_0.55)] focus-visible:ring-brand-primary",
  secondary:
    "bg-brand-secondary text-white shadow-[0_10px_24px_-10px_rgb(242_140_40_/_0.6)] hover:bg-[#e07b18] focus-visible:ring-brand-secondary",
  outline:
    "border border-brand-primary/40 bg-white text-brand-primary hover:border-brand-primary hover:bg-brand-tint focus-visible:ring-brand-primary",
  ghost:
    "border border-transparent bg-transparent text-brand-ink hover:bg-[#F5F0F2] focus-visible:ring-brand-primary",
  soft:
    "border border-transparent bg-brand-tint text-brand-primary hover:bg-[#FFE3EF] focus-visible:ring-brand-primary",
  white:
    "border border-white/40 bg-white text-brand-primary shadow-md shadow-black/10 hover:bg-[#FFF8FB] focus-visible:ring-white",
};

const sizes = {
  sm: "h-9 min-h-9 px-3.5 text-sm",
  md: "h-11 min-h-11 px-5 text-sm",
  lg: "h-12 min-h-12 px-6 text-[15px]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  href,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold tracking-tight whitespace-nowrap transition duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
