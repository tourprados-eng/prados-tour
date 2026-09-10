import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-[#EBE4E7] bg-white px-4 py-3 text-[#2F2328] shadow-sm outline-none transition",
        "placeholder:text-[#9A8A92]",
        "hover:border-[#D9CED3]",
        "focus:border-[#E84C91] focus:ring-2 focus:ring-[#E84C91]/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-semibold text-[#3D2A33]", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-[#EBE4E7] bg-white px-4 py-3 text-[#2F2328] shadow-sm outline-none transition",
        "placeholder:text-[#9A8A92]",
        "hover:border-[#D9CED3]",
        "focus:border-[#E84C91] focus:ring-2 focus:ring-[#E84C91]/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-[#EBE4E7] bg-white px-4 py-3 text-[#2F2328] shadow-sm outline-none transition",
        "hover:border-[#D9CED3]",
        "focus:border-[#E84C91] focus:ring-2 focus:ring-[#E84C91]/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
