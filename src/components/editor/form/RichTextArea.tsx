"use client";

import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { Bold, Italic, Link2, Superscript } from "lucide-react";
import { toggleWrap } from "@/lib/resume/richtext";
import { cx } from "../../ui";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  /** Show the B / I / sup / link toolbar. */
  rich?: boolean;
  bold?: boolean;
  autoFocus?: boolean;
  "data-edit-path"?: string;
}

/** Auto-growing textarea that understands the resume markup (**bold**, *italic*, ^sup^, [link](url)). */
export const RichTextArea = forwardRef<HTMLTextAreaElement, Props>(function RichTextArea(
  { value, onChange, onFocus, onKeyDown, placeholder, className, rich = true, bold, autoFocus, ...rest },
  forwardedRef,
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(resize, [value, resize]);

  const wrap = (token: string) => {
    const el = ref.current;
    if (!el) return;
    const next = toggleWrap(el.value, el.selectionStart, el.selectionEnd, token);
    onChange(next.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
    });
  };

  const link = () => {
    const el = ref.current;
    if (!el) return;
    const url = prompt("Link URL", "https://");
    if (!url) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const label = el.value.slice(s, e) || url;
    const md = `[${label}](${url})`;
    onChange(el.value.slice(0, s) + md + el.value.slice(e));
  };

  return (
    <div className="group/rt relative">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        spellCheck
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          const mod = e.metaKey || e.ctrlKey;
          if (rich && mod && e.key.toLowerCase() === "b") {
            e.preventDefault();
            wrap("**");
            return;
          }
          if (rich && mod && e.key.toLowerCase() === "i") {
            e.preventDefault();
            wrap("*");
            return;
          }
          onKeyDown?.(e);
        }}
        className={cx(
          "block w-full resize-none overflow-hidden rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] leading-[1.45] text-zinc-900 outline-none transition-shadow placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15",
          bold && "font-semibold",
          className,
        )}
        {...rest}
      />
      {rich && (
        <div className="pointer-events-none absolute -top-3 right-2 z-10 flex gap-0.5 rounded-md border border-zinc-200 bg-white p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within/rt:pointer-events-auto group-focus-within/rt:opacity-100">
          {[
            { label: "Bold (⌘B)", icon: <Bold className="size-3" />, fn: () => wrap("**") },
            { label: "Italic (⌘I)", icon: <Italic className="size-3" />, fn: () => wrap("*") },
            { label: "Superscript", icon: <Superscript className="size-3" />, fn: () => wrap("^") },
            { label: "Link", icon: <Link2 className="size-3" />, fn: link },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              title={b.label}
              aria-label={b.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={b.fn}
              className="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {b.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
