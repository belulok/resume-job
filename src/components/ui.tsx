"use client";

import { forwardRef } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
        variant === "primary" && "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500",
        variant === "secondary" && "border border-zinc-200 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50",
        variant === "ghost" && "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        variant === "danger" && "text-red-600 hover:bg-red-50",
        className,
      )}
      {...props}
    />
  );
});

export function IconButton({
  label,
  className,
  active,
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30",
        size === "sm" ? "size-6" : "size-8",
        active ? "bg-indigo-50 text-indigo-600" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
        className,
      )}
      {...props}
    />
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 font-mono text-[10px] text-zinc-500">
      {children}
    </kbd>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{children}</div>;
}

export const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15";

export function Select<T extends string>({
  value,
  options,
  onChange,
  className,
  title,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
  title?: string;
}) {
  return (
    <select
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cx(
        "h-7 rounded-md border border-zinc-200 bg-white px-1.5 text-xs text-zinc-700 outline-none focus:border-indigo-400",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function NumberField({
  value,
  onChange,
  label,
  step = 1,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  label: string;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-zinc-500" title={`${label} (pt)`}>
      {label}
      <input
        type="number"
        step={step}
        value={value ?? ""}
        placeholder="0"
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="h-7 w-14 rounded-md border border-zinc-200 bg-white px-1.5 text-xs text-zinc-700 outline-none focus:border-indigo-400"
      />
    </label>
  );
}
