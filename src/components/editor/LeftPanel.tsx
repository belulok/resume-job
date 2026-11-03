"use client";

import { PenLine, Sparkles } from "lucide-react";
import { useEditor, type LeftTab } from "@/store/editor-store";
import { cx } from "../ui";
import { ChatPanel } from "./chat/ChatPanel";
import { FormEditor } from "./form/FormEditor";

const TABS: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
  { id: "edit", label: "Edit", icon: <PenLine className="size-3.5" /> },
  { id: "chat", label: "AI Chat", icon: <Sparkles className="size-3.5" /> },
];

export function LeftPanel() {
  const tab = useEditor((s) => s.tab);
  const setTab = useEditor((s) => s.setTab);

  return (
    <aside className="flex w-[440px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/60">
      <div className="shrink-0 border-b border-zinc-200 bg-white p-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex h-7 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-all",
                tab === t.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {/* Both panels stay mounted so scroll position / drafts survive tab switches. */}
      <div className={cx("min-h-0 flex-1", tab !== "edit" && "hidden")}>
        <FormEditor />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "chat" && "hidden")}>
        <ChatPanel />
      </div>
    </aside>
  );
}
