"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { newBlock, newEntryLike, newSection } from "@/lib/resume/factory";
import { entryLabel, parsePointer } from "@/lib/resume/paths";
import type { BlockType, Column, Entry, Resume, Section } from "@/lib/resume/types";
import { SPACING } from "@/lib/resume/units";
import { useEditor } from "@/store/editor-store";
import { FieldLabel, IconButton, NumberField, Select, cx, inputClass } from "../../ui";
import { BLOCK_META, BlockEditor } from "./BlockEditor";

const select = (path: string) => useEditor.getState().select(path);

function HeaderCard({ resume }: { resume: Resume }) {
  const { updateAt, insertAt, removeAt } = useEditor.getState();
  const { header } = resume;
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs" data-edit-path="/header">
      <h3 className="mb-2 text-[13px] font-semibold text-zinc-900">Header</h3>
      <div data-edit-path="/header/name">
        <FieldLabel>Full name</FieldLabel>
        <input
          className={inputClass}
          value={header.name}
          onFocus={() => select("/header/name")}
          onChange={(e) => updateAt("/header/name", e.target.value)}
        />
      </div>
      <div className="mt-3">
        <FieldLabel>Contact lines</FieldLabel>
        <div className="space-y-1.5">
          {header.contacts.map((c, i) => {
            const path = `/header/contacts/${i}`;
            return (
              <div key={c.id} className="group/item flex items-center gap-1.5" data-edit-path={path}>
                <input
                  className={cx(inputClass, "flex-[3]")}
                  value={c.label}
                  placeholder="Email, phone, city…"
                  onFocus={() => select(path)}
                  onChange={(e) => updateAt(`${path}/label`, e.target.value)}
                />
                <input
                  className={cx(inputClass, "flex-[2] font-mono text-xs")}
                  value={c.url ?? ""}
                  placeholder="link (optional)"
                  onFocus={() => select(path)}
                  onChange={(e) => updateAt(`${path}/url`, e.target.value || undefined)}
                />
                <IconButton
                  size="sm"
                  label="Remove"
                  className="opacity-0 group-hover/item:opacity-100"
                  onClick={() => removeAt(path)}
                >
                  <X className="size-3.5" />
                </IconButton>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => insertAt("/header/contacts/-", { id: `c${Date.now()}`, label: "" })}
          className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        >
          <Plus className="size-3" /> Add contact line
        </button>
      </div>
    </section>
  );
}

function AddBlockBar({ path, column }: { path: string; column: Column }) {
  const insertAt = useEditor((s) => s.insertAt);
  return (
    <div className="flex flex-wrap items-center gap-1 pt-1">
      <span className="mr-1 text-[11px] text-zinc-400">Add</span>
      {(Object.keys(BLOCK_META) as BlockType[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => insertAt(`${path}/blocks/-`, newBlock(t, column))}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 px-1.5 py-0.5 text-[11px] text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
        >
          {BLOCK_META[t].icon}
          {BLOCK_META[t].label}
        </button>
      ))}
    </div>
  );
}

const EntryCard = memo(function EntryCard({
  entry,
  label,
  path,
  index,
  count,
  column,
  open,
  onToggle,
}: {
  entry: Entry;
  label: string;
  path: string;
  index: number;
  count: number;
  column: Column;
  open: boolean;
  onToggle: () => void;
}) {
  const { moveAt, removeAt, duplicateAt } = useEditor.getState();
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70" data-edit-path={path}>
      <div className="group/entry flex items-center gap-1 px-1.5 py-1">
        <button
          type="button"
          onClick={() => {
            onToggle();
            select(path);
          }}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left"
        >
          <ChevronRight className={cx("size-3.5 shrink-0 text-zinc-400 transition-transform", open && "rotate-90")} />
          <span className="truncate text-[13px] font-medium text-zinc-800">{label}</span>
        </button>
        <div className="flex items-center opacity-0 transition-opacity group-hover/entry:opacity-100">
          <IconButton size="sm" label="Move up" disabled={index === 0} onClick={() => moveAt(path, -1)}>
            <ArrowUp className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Move down" disabled={index === count - 1} onClick={() => moveAt(path, 1)}>
            <ArrowDown className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Duplicate" onClick={() => duplicateAt(path)}>
            <Copy className="size-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            label="Delete entry"
            className="hover:text-red-600"
            onClick={() => confirm(`Delete "${label}"?`) && removeAt(path)}
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
      {open && (
        <div className="space-y-2 border-t border-zinc-200 p-2">
          {entry.blocks.map((b, bi) => (
            <BlockEditor
              key={b.id}
              block={b}
              path={`${path}/blocks/${bi}`}
              index={bi}
              count={entry.blocks.length}
              column={column}
            />
          ))}
          <AddBlockBar path={path} column={column} />
        </div>
      )}
    </div>
  );
});

function SectionStyle({ section, path }: { section: Section; path: string }) {
  const updateAt = useEditor((s) => s.updateAt);
  const col = section.column;
  return (
    <div className="flex flex-wrap gap-2 rounded-md bg-zinc-50 p-2">
      <NumberField label="Space before" value={section.gap ?? SPACING.sectionGap[col]} onChange={(v) => updateAt(`${path}/gap`, v)} />
      <NumberField label="Below heading" value={section.headingGap ?? SPACING.headingGap[col]} onChange={(v) => updateAt(`${path}/headingGap`, v)} />
      <NumberField label="Between entries" value={section.entryGap ?? SPACING.entryGap[col]} onChange={(v) => updateAt(`${path}/entryGap`, v)} />
    </div>
  );
}

function SectionCard({
  resume,
  section,
  index,
  open,
  openEntries,
  onToggle,
  onToggleEntry,
}: {
  resume: Resume;
  section: Section;
  index: number;
  open: boolean;
  openEntries: Set<string>;
  onToggle: () => void;
  onToggleEntry: (id: string) => void;
}) {
  const [showStyle, setShowStyle] = useState(false);
  const { updateAt, moveAt, removeAt, insertAt } = useEditor.getState();
  const path = `/sections/${index}`;
  const count = resume.sections.length;

  return (
    <section
      className={cx("rounded-xl border bg-white shadow-xs", section.hidden ? "border-dashed border-zinc-300" : "border-zinc-200")}
      data-edit-path={path}
    >
      <div className="group/section flex items-center gap-1 p-1.5">
        <IconButton size="sm" label={open ? "Collapse" : "Expand"} onClick={onToggle}>
          <ChevronRight className={cx("size-4 transition-transform", open && "rotate-90")} />
        </IconButton>
        <input
          value={section.title}
          onFocus={() => select(path)}
          onChange={(e) => updateAt(`${path}/title`, e.target.value)}
          className={cx(
            "h-7 min-w-0 flex-1 rounded-md border border-transparent px-1.5 text-[13px] font-semibold tracking-wide text-zinc-900 outline-none hover:border-zinc-200 focus:border-indigo-400",
            section.hidden && "text-zinc-400 line-through",
          )}
        />
        <Select
          title="Column"
          value={section.column}
          options={[
            { value: "left", label: "Left col" },
            { value: "right", label: "Right col" },
          ]}
          onChange={(v) => updateAt(`${path}/column`, v)}
        />
        <div className="flex items-center opacity-60 transition-opacity group-hover/section:opacity-100">
          <IconButton size="sm" label="Spacing" active={showStyle} onClick={() => setShowStyle((v) => !v)}>
            <SlidersHorizontal className="size-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            label={section.hidden ? "Show section" : "Hide section"}
            onClick={() => updateAt(`${path}/hidden`, section.hidden ? undefined : true)}
          >
            {section.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </IconButton>
          <IconButton size="sm" label="Move up" disabled={index === 0} onClick={() => moveAt(path, -1)}>
            <ArrowUp className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Move down" disabled={index === count - 1} onClick={() => moveAt(path, 1)}>
            <ArrowDown className="size-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            label="Delete section"
            className="hover:text-red-600"
            onClick={() => confirm(`Delete the "${section.title}" section?`) && removeAt(path)}
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
      {showStyle && (
        <div className="px-2 pb-2">
          <SectionStyle section={section} path={path} />
        </div>
      )}
      {open && (
        <div className="space-y-1.5 border-t border-zinc-100 p-2">
          {section.entries.map((entry, ei) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              label={entryLabel(resume, index, ei)}
              path={`${path}/entries/${ei}`}
              index={ei}
              count={section.entries.length}
              column={section.column}
              open={openEntries.has(entry.id)}
              onToggle={() => onToggleEntry(entry.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              const entry = newEntryLike(section.entries[section.entries.length - 1], section.column);
              insertAt(`${path}/entries/-`, entry);
              onToggleEntry(entry.id);
            }}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
          >
            <Plus className="size-3.5" /> Add entry
          </button>
        </div>
      )}
    </section>
  );
}

function toggle(set: Set<string>, id: string, force?: boolean) {
  const next = new Set(set);
  const on = force ?? !next.has(id);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export function FormEditor() {
  const resume = useEditor((s) => s.resume);
  const revealRequest = useEditor((s) => s.revealRequest);
  const selectedPath = useEditor((s) => s.selectedPath);
  const insertAt = useEditor((s) => s.insertAt);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set([resume.sections[1]?.id ?? ""]));
  const [openEntries, setOpenEntries] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reveal + focus the field for a path selected in the preview.
  useEffect(() => {
    if (!revealRequest) return;
    const segs = parsePointer(revealRequest.path);
    const { resume } = useEditor.getState();
    if (segs[0] === "sections") {
      const section = resume.sections[Number(segs[1])];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- expanding the accordion is the point of the reveal
      if (section) setOpenSections((s) => toggle(s, section.id, true));
      const entry = segs[3] !== undefined ? section?.entries[Number(segs[3])] : undefined;
      if (entry) setOpenEntries((s) => toggle(s, entry.id, true));
    }
    const frame = requestAnimationFrame(() => {
      const root = scrollRef.current;
      if (!root) return;
      let path = revealRequest.path;
      let el: HTMLElement | null = null;
      while (path && !(el = root.querySelector<HTMLElement>(`[data-edit-path="${CSS.escape(path)}"]`))) {
        path = path.slice(0, path.lastIndexOf("/"));
      }
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.remove("field-flash");
      void el.offsetWidth;
      el.classList.add("field-flash");
      // Only focus leaf fields; focusing inside a container would re-select a child element.
      const fields = el.matches("input, textarea") ? [el] : [...el.querySelectorAll<HTMLElement>("textarea, input")];
      if (revealRequest.focus && path === revealRequest.path && fields.length === 1) {
        fields[0].focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [revealRequest]);

  const selectedSection = selectedPath?.startsWith("/sections/") ? Number(parsePointer(selectedPath)[1]) : -1;

  return (
    <div ref={scrollRef} className="scrollbar-thin h-full space-y-2.5 overflow-y-auto p-3">
      <p className="px-1 text-xs leading-relaxed text-zinc-500">
        Click anything in the preview to jump to it here. Use <b>**bold**</b> and <i>*italic*</i> markup, or the
        B / I buttons.
      </p>
      <HeaderCard resume={resume} />
      {resume.sections.map((section, si) => (
        <div key={section.id} className={cx(selectedSection === si && "rounded-xl ring-2 ring-indigo-500/20")}>
          <SectionCard
            resume={resume}
            section={section}
            index={si}
            open={openSections.has(section.id)}
            openEntries={openEntries}
            onToggle={() => setOpenSections((s) => toggle(s, section.id))}
            onToggleEntry={(id) => setOpenEntries((s) => toggle(s, id))}
          />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 pb-6">
        {(["left", "right"] as const).map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => {
              const section = newSection(col);
              insertAt("/sections/-", section);
              setOpenSections((s) => toggle(s, section.id, true));
              setOpenEntries((s) => toggle(s, section.entries[0].id, true));
            }}
            className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 bg-white py-2.5 text-xs font-medium text-zinc-600 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
          >
            <Plus className="size-3.5" /> Section ({col} column)
          </button>
        ))}
      </div>
    </div>
  );
}
