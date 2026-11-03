"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  Maximize2,
  Minus,
  MousePointerClick,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { arrayItemInfo, describePath, editableTextPath, getAt } from "@/lib/resume/paths";
import { useEditor } from "@/store/editor-store";
import { IconButton, cx } from "../../ui";
import { RichTextArea } from "../form/RichTextArea";

const PAGE_WIDTH_PX = 816; // 612pt
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function QuickEdit({ path, box }: { path: string; box: Box }) {
  const resume = useEditor((s) => s.resume);
  const updateAt = useEditor((s) => s.updateAt);
  const setQuickEdit = useEditor((s) => s.setQuickEdit);
  const textPath = editableTextPath(resume, path);
  const value = textPath ? getAt<string>(resume, textPath) : undefined;
  if (!textPath || typeof value !== "string") return null;

  return (
    <div
      className="pointer-events-auto absolute z-30 rounded-xl border border-zinc-200 bg-white p-2 shadow-2xl shadow-zinc-900/20"
      style={{ left: box.x, top: box.y + box.h + 8, width: Math.max(320, Math.min(box.w + 24, 560)) }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <RichTextArea
        autoFocus
        value={value}
        onChange={(v) => updateAt(textPath, v)}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            setQuickEdit(null);
          }
        }}
      />
      <div className="mt-1.5 flex items-center justify-between px-0.5 text-[11px] text-zinc-400">
        <span>Edits apply live · **bold** *italic*</span>
        <button
          className="rounded-md bg-indigo-600 px-2 py-0.5 font-medium text-white hover:bg-indigo-500"
          onClick={() => setQuickEdit(null)}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function SelectionToolbar({ path, box }: { path: string; box: Box }) {
  const resume = useEditor((s) => s.resume);
  const s = useEditor.getState();
  const info = arrayItemInfo(resume, path);
  const canEdit = editableTextPath(resume, path) !== null;
  const crumbs = describePath(resume, path);
  const label = crumbs[crumbs.length - 1]?.label ?? "";

  const above = box.y > 40;
  return (
    <div
      className="pointer-events-auto absolute z-20 flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5 shadow-lg shadow-zinc-900/10"
      style={{ left: box.x, top: above ? box.y - 36 : box.y + box.h + 6 }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="max-w-44 truncate px-1.5 text-[11px] font-medium text-indigo-600">{label}</span>
      <div className="h-4 w-px bg-zinc-200" />
      {canEdit && (
        <IconButton size="sm" label="Edit text (double-click)" onClick={() => s.setQuickEdit(path)}>
          <Pencil className="size-3.5" />
        </IconButton>
      )}
      <IconButton
        size="sm"
        label="Ask AI about this"
        onClick={() => {
          s.setTab("chat");
          requestAnimationFrame(() => document.getElementById("chat-input")?.focus());
        }}
      >
        <Sparkles className="size-3.5 text-indigo-500" />
      </IconButton>
      {info && (
        <>
          <IconButton size="sm" label="Move up" disabled={info.index === 0} onClick={() => s.moveAt(path, -1)}>
            <ArrowUp className="size-3.5" />
          </IconButton>
          <IconButton
            size="sm"
            label="Move down"
            disabled={info.index === info.length - 1}
            onClick={() => s.moveAt(path, 1)}
          >
            <ArrowDown className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Duplicate" onClick={() => s.duplicateAt(path)}>
            <Copy className="size-3.5" />
          </IconButton>
          <IconButton size="sm" label="Delete (⌫)" className="hover:text-red-600" onClick={() => s.removeAt(path)}>
            <Trash2 className="size-3.5" />
          </IconButton>
        </>
      )}
    </div>
  );
}

function StatusBar({ pages, scale }: { pages: number; scale: number }) {
  const resume = useEditor((s) => s.resume);
  const selectedPath = useEditor((s) => s.selectedPath);
  const hoveredPath = useEditor((s) => s.hoveredPath);
  const inspect = useEditor((s) => s.inspect);
  const zoom = useEditor((s) => s.zoom);
  const { setInspect, setZoom, select } = useEditor.getState();
  const path = selectedPath ?? hoveredPath;
  const crumbs = path ? describePath(resume, path) : [];

  const step = (dir: 1 | -1) => {
    const next =
      dir > 0 ? ZOOM_STEPS.find((z) => z > scale + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < scale - 0.001);
    if (next) setZoom(next);
  };

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-t border-zinc-200 bg-white px-2 text-xs text-zinc-600">
      <button
        onClick={() => setInspect(!inspect)}
        className={cx(
          "flex h-6 items-center gap-1.5 rounded-md px-2 font-medium transition-colors",
          inspect ? "bg-indigo-50 text-indigo-700" : "text-zinc-500 hover:bg-zinc-100",
        )}
        title="Inspect mode: hover to highlight, click to select, double-click to edit"
      >
        <MousePointerClick className="size-3.5" /> Inspect {inspect ? "on" : "off"}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
        {crumbs.length === 0 ? (
          <span className="text-zinc-400">Hover the resume to inspect · click to select · double-click to edit</span>
        ) : (
          crumbs.map((c, i) => (
            <span key={c.path} className="flex min-w-0 items-center gap-0.5">
              {i > 0 && <ChevronRight className="size-3 shrink-0 text-zinc-300" />}
              <button
                onClick={() => select(c.path, { reveal: true })}
                className={cx(
                  "truncate rounded px-1 py-0.5 hover:bg-zinc-100",
                  c.path === selectedPath ? "font-medium text-indigo-700" : "text-zinc-600",
                )}
              >
                {c.label}
              </button>
            </span>
          ))
        )}
      </div>
      <span className="shrink-0 text-zinc-400">
        {pages} {pages === 1 ? "page" : "pages"} · Letter
      </span>
      <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-200 p-0.5">
        <IconButton size="sm" label="Zoom out" onClick={() => step(-1)}>
          <Minus className="size-3.5" />
        </IconButton>
        <span className="w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <IconButton size="sm" label="Zoom in" onClick={() => step(1)}>
          <Plus className="size-3.5" />
        </IconButton>
        <IconButton size="sm" label="Fit width" active={zoom === "fit"} onClick={() => setZoom("fit")}>
          <Maximize2 className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

export function Preview() {
  const resume = useEditor((s) => s.resume);
  const zoom = useEditor((s) => s.zoom);
  const inspect = useEditor((s) => s.inspect);
  const selectedPath = useEditor((s) => s.selectedPath);
  const hoveredPath = useEditor((s) => s.hoveredPath);
  const quickEditPath = useEditor((s) => s.quickEditPath);
  const flash = useEditor((s) => s.flash);
  const layout = useEditor((s) => s.layout);
  const setLayout = useEditor((s) => s.setLayout);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const viewport = useElementSize(scrollRef);
  const pagesSize = useElementSize(pagesRef);

  const fitScale = viewport.w ? Math.max(0.35, Math.min(1.5, (viewport.w - 64) / PAGE_WIDTH_PX)) : 1;
  const scale = zoom === "fit" ? fitScale : zoom;

  const [hoverBox, setHoverBox] = useState<Box | null>(null);
  const [selectBox, setSelectBox] = useState<Box | null>(null);
  const [flashBoxes, setFlashBoxes] = useState<{ key: string; box: Box }[]>([]);

  const boxFor = useCallback((path: string | null): Box | null => {
    if (!path) return null;
    const el = pagesRef.current?.querySelector(`[data-path="${CSS.escape(path)}"]`);
    const content = contentRef.current;
    if (!el || !content) return null;
    const r = el.getBoundingClientRect();
    const c = content.getBoundingClientRect();
    return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
  }, []);

  // Re-measure overlay boxes whenever anything that can move them changes.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- boxes are derived from the DOM after layout
    setHoverBox(inspect && hoveredPath !== selectedPath ? boxFor(hoveredPath) : null);
    setSelectBox(boxFor(selectedPath));
  }, [hoveredPath, selectedPath, inspect, resume, scale, layout, pagesSize.h, boxFor]);

  // Keep the selection visible when it is changed from the form editor.
  useEffect(() => {
    if (!selectedPath) return;
    const el = pagesRef.current?.querySelector(`[data-path="${CSS.escape(selectedPath)}"]`);
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    const r = el.getBoundingClientRect();
    const v = scroller.getBoundingClientRect();
    if (r.top < v.top + 40 || r.bottom > v.bottom - 40) {
      scroller.scrollBy({ top: r.top - v.top - v.height / 3, behavior: "smooth" });
    }
  }, [selectedPath, layout]);

  // Highlight elements changed by the AI.
  useEffect(() => {
    if (!flash) return;
    const frame = requestAnimationFrame(() => {
      const boxes = flash.paths
        .map((p) => ({ key: `${flash.nonce}:${p}`, box: boxFor(p) }))
        .filter((b): b is { key: string; box: Box } => !!b.box);
      setFlashBoxes(boxes);
    });
    const t = setTimeout(() => setFlashBoxes([]), 2400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t);
    };
  }, [flash, boxFor]);

  // Ctrl/⌘ + wheel zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { zoom } = useEditor.getState();
      const current = zoom === "fit" ? fitScale : zoom;
      const next = Math.max(0.35, Math.min(2.5, current * (e.deltaY > 0 ? 0.92 : 1.08)));
      useEditor.getState().setZoom(Math.round(next * 100) / 100);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fitScale]);

  const pathFromEvent = (e: React.MouseEvent) =>
    (e.target as Element).closest("[data-path]")?.getAttribute("data-path") ?? null;

  const hoverCrumbs = useMemo(
    () => (hoveredPath ? describePath(resume, hoveredPath).slice(-2) : []),
    [resume, hoveredPath],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-auto bg-canvas"
        style={{
          backgroundImage: "radial-gradient(circle, rgb(0 0 0 / 0.07) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget || e.target === contentRef.current?.parentElement) {
            useEditor.getState().select(null);
          }
        }}
      >
        <div className="flex min-w-fit justify-center px-8 py-8">
          <div
            ref={contentRef}
            className="relative"
            style={{ width: pagesSize.w * scale, height: pagesSize.h * scale }}
          >
            <div
              ref={pagesRef}
              className={cx("preview-pages absolute left-0 top-0 origin-top-left", inspect && "cursor-default")}
              style={{ transform: `scale(${scale})` }}
              onMouseMove={(e) => inspect && useEditor.getState().hover(pathFromEvent(e))}
              onMouseLeave={() => useEditor.getState().hover(null)}
              onClickCapture={(e) => {
                if ((e.target as Element).closest("a")) e.preventDefault();
              }}
              onClick={(e) => {
                if (!inspect) return;
                const path = pathFromEvent(e);
                const s = useEditor.getState();
                if (!path) return s.select(null);
                if (e.altKey) {
                  const crumbs = describePath(s.resume, path);
                  const parent = crumbs[crumbs.length - 2]?.path;
                  return s.select(parent ?? path, { reveal: s.tab === "edit" });
                }
                s.select(path, { reveal: s.tab === "edit" });
              }}
              onDoubleClick={(e) => {
                if (!inspect) return;
                const path = pathFromEvent(e);
                const s = useEditor.getState();
                if (path && editableTextPath(s.resume, path)) {
                  window.getSelection()?.removeAllRanges();
                  s.select(path);
                  s.setQuickEdit(path);
                }
              }}
            >
              <ResumeDocument resume={resume} onLayout={setLayout} />
            </div>

            {/* Inspector overlay (unscaled, in content coordinates) */}
            <div className="pointer-events-none absolute inset-0">
              {flashBoxes.map(({ key, box }) => (
                <div
                  key={key}
                  className="change-flash absolute rounded-sm bg-emerald-400/25 ring-2 ring-emerald-500"
                  style={{ left: box.x - 2, top: box.y - 2, width: box.w + 4, height: box.h + 4 }}
                />
              ))}
              {hoverBox && (
                <>
                  <div
                    className="absolute rounded-sm bg-sky-400/10 ring-1 ring-sky-500"
                    style={{ left: hoverBox.x - 2, top: hoverBox.y - 1, width: hoverBox.w + 4, height: hoverBox.h + 2 }}
                  />
                  {hoverCrumbs.length > 0 && (
                    <div
                      className="absolute whitespace-nowrap rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
                      style={{ left: hoverBox.x - 2, top: Math.max(0, hoverBox.y - 19) }}
                    >
                      {hoverCrumbs.map((c) => c.label).join(" › ")}
                    </div>
                  )}
                </>
              )}
              {selectBox && selectedPath && (
                <>
                  <div
                    className="absolute rounded-sm ring-2 ring-indigo-600"
                    style={{ left: selectBox.x - 2, top: selectBox.y - 1, width: selectBox.w + 4, height: selectBox.h + 2 }}
                  />
                  {quickEditPath === selectedPath ? (
                    <QuickEdit path={selectedPath} box={selectBox} />
                  ) : (
                    <SelectionToolbar path={selectedPath} box={selectBox} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <StatusBar pages={layout.length} scale={scale} />
    </div>
  );
}
