import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "soft" | "white";
  size?: "sm" | "md" | "lg";
  href?: string;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[#E84C91] text-white shadow-sm shadow-[#E84C91]/25 hover:bg-[#d63d7f] hover:shadow-md focus-visible:ring-[#E84C91]",
  secondary:
    "bg-[#F28C28] text-white shadow-sm shadow-[#F28C28]/25 hover:bg-[#e07b18] hover:shadow-md focus-visible:ring-[#F28C28]",
  outline:
    "border border-[#E84C91]/40 bg-white text-[#E84C91] hover:border-[#E84C91] hover:bg-[#FFF0F6] focus-visible:ring-[#E84C91]",
  ghost:
    "border border-transparent bg-transparent text-[#3D2A33] hover:bg-[#F5F0F2] focus-visible:ring-[#E84C91]",
  soft:
    "border border-transparent bg-[#FFF0F6] text-[#E84C91] hover:bg-[#FFE3EF] focus-visible:ring-[#E84C91]",
  white:
    "border border-white/40 bg-white text-[#E84C91] shadow-md shadow-black/10 hover:bg-[#FFF8FB] focus-visible:ring-white",
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
