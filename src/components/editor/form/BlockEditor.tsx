"use client";

import { memo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Heading,
  Link2,
  List,
  Plus,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
} from "lucide-react";
import type { Align, Block, BulletMarker, Column } from "@/lib/resume/types";
import { useEditor } from "@/store/editor-store";
import { IconButton, NumberField, Select, cx, inputClass } from "../../ui";
import { RichTextArea } from "./RichTextArea";

export const BLOCK_META: Record<Block["type"], { label: string; icon: React.ReactNode }> = {
  title: { label: "Title", icon: <Heading className="size-3.5" /> },
  text: { label: "Text", icon: <Type className="size-3.5" /> },
  bullets: { label: "Bullets", icon: <List className="size-3.5" /> },
  links: { label: "Links", icon: <Link2 className="size-3.5" /> },
};

const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "justify", label: "Justify" },
];

const MARKER_OPTIONS: { value: BulletMarker; label: string }[] = [
  { value: "disc", label: "• Black disc" },
  { value: "dot", label: "● Gray dot" },
  { value: "inline", label: "· Inline (skills)" },
];

const select = (path: string) => useEditor.getState().select(path);

function BlockStyle({ block, path }: { block: Block; path: string }) {
  const updateAt = useEditor((s) => s.updateAt);
  const set = (key: string, value: unknown) => updateAt(`${path}/${key}`, value);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 p-2">
      <NumberField label="Space before" value={block.gap} onChange={(v) => set("gap", v)} />
      {block.type !== "links" && (
        <Select
          title="Alignment"
          value={block.align ?? "left"}
          options={ALIGN_OPTIONS}
          onChange={(v) => set("align", v === "left" ? undefined : v)}
        />
      )}
      {block.type === "text" && (
        <>
          <Select
            title="Size"
            value={block.size ?? "md"}
            options={[
              { value: "md", label: "Normal 8pt" },
              { value: "xs", label: "Small 5.5pt" },
            ]}
            onChange={(v) => set("size", v === "md" ? undefined : v)}
          />
          <NumberField label="Indent" value={block.indent} onChange={(v) => set("indent", v)} />
        </>
      )}
      {block.type === "bullets" && (
        <>
          <Select
            title="Bullet style"
            value={block.marker ?? "disc"}
            options={MARKER_OPTIONS}
            onChange={(v) => set("marker", v)}
          />
          <NumberField
            label="Item spacing"
            step={0.5}
            value={block.spacing}
            onChange={(v) => set("spacing", v)}
          />
        </>
      )}
    </div>
  );
}

function BulletsEditor({ items, path }: { items: string[]; path: string }) {
  const { updateAt, insertAt, removeAt } = useEditor.getState();

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const itemPath = `${path}/items/${i}`;
        return (
          <div key={i} className="group/item flex items-start gap-1.5" data-edit-path={itemPath}>
            <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-zinc-300" />
            <div className="min-w-0 flex-1">
              <RichTextArea
                value={item}
                onChange={(v) => updateAt(itemPath, v)}
                onFocus={() => select(itemPath)}
                placeholder="Describe an achievement…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const next = `${path}/items/${i + 1}`;
                    insertAt(next, "");
                    useEditor.getState().select(next, { reveal: true, focus: true });
                  } else if (e.key === "Backspace" && item === "" && items.length > 1) {
                    e.preventDefault();
                    removeAt(itemPath);
                    if (i > 0) useEditor.getState().select(`${path}/items/${i - 1}`, { reveal: true, focus: true });
                  }
                }}
              />
            </div>
            <IconButton
              size="sm"
              label="Remove bullet"
              className="mt-1 opacity-0 group-hover/item:opacity-100"
              onClick={() => removeAt(itemPath)}
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => {
          const next = `${path}/items/${items.length}`;
          insertAt(next, "");
          useEditor.getState().select(next, { reveal: true, focus: true });
        }}
        className="ml-3 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
      >
        <Plus className="size-3" /> Add bullet <span className="text-zinc-400">(or press Enter)</span>
      </button>
    </div>
  );
}

function LinksEditor({ items, path }: { items: { label: string; url: string }[]; path: string }) {
  const { updateAt, insertAt, removeAt } = useEditor.getState();
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const itemPath = `${path}/items/${i}`;
        return (
          <div key={i} className="group/item flex items-center gap-1.5" data-edit-path={itemPath}>
            <input
              className={cx(inputClass, "flex-1")}
              value={item.label}
              placeholder="Label"
              onFocus={() => select(itemPath)}
              onChange={(e) => updateAt(`${itemPath}/label`, e.target.value)}
            />
            <input
              className={cx(inputClass, "flex-1 font-mono text-xs")}
              value={item.url}
              placeholder="https://"
              onFocus={() => select(itemPath)}
              onChange={(e) => updateAt(`${itemPath}/url`, e.target.value)}
            />
            <IconButton
              size="sm"
              label="Remove link"
              className="opacity-0 group-hover/item:opacity-100"
              onClick={() => removeAt(itemPath)}
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => insertAt(`${path}/items/-`, { label: "", url: "https://" })}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
      >
        <Plus className="size-3" /> Add link
      </button>
    </div>
  );
}

export const BlockEditor = memo(function BlockEditor({
  block,
  path,
  index,
  count,
}: {
  block: Block;
  path: string;
  index: number;
  count: number;
  column: Column;
}) {
  const [showStyle, setShowStyle] = useState(false);
  const { updateAt, moveAt, removeAt } = useEditor.getState();
  const meta = BLOCK_META[block.type];

  return (
    <div className="group/block rounded-lg border border-zinc-200 bg-white p-2" data-edit-path={path}>
      <div className="mb-1.5 flex items-center gap-1">
        <span className="flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
          {meta.icon}
          {meta.label}
        </span>
        <div className="ml-auto flex items-center opacity-0 transition-opacity group-focus-within/block:opacity-100 group-hover/block:opacity-100">
          <IconButton size="sm" label="Style" active={showStyle} onClick={() => setShowStyle((v) => !v)}>
            <SlidersHorizontal className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Move up" disabled={index === 0} onClick={() => moveAt(path, -1)}>
            <ArrowUp className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Move down" disabled={index === count - 1} onClick={() => moveAt(path, 1)}>
            <ArrowDown className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Delete block" className="hover:text-red-600" onClick={() => removeAt(path)}>
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>

      {(block.type === "title" || block.type === "text") && (
        <RichTextArea
          value={block.text}
          bold={block.type === "title"}
          onChange={(v) => updateAt(`${path}/text`, v)}
          onFocus={() => select(path)}
          placeholder={block.type === "title" ? "Title" : "Text"}
        />
      )}
      {block.type === "bullets" && <BulletsEditor items={block.items} path={path} />}
      {block.type === "links" && <LinksEditor items={block.items} path={path} />}
      {showStyle && <BlockStyle block={block} path={path} />}
    </div>
  );
});
