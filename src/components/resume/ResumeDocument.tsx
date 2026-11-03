"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Resume } from "@/lib/resume/types";
import {
  buildUnits,
  combineColumns,
  paginateColumn,
  type PageLayout,
  type Unit,
} from "@/lib/resume/units";
import { CLASSIC, ClassicUnit } from "@/templates/classic/ClassicTemplate";

const PT = 4 / 3; // CSS px per pt
const CONTENT_HEIGHT_PX = CLASSIC.contentHeightPt * PT;

const FONT_PROBES = [
  "8pt Carlito",
  "bold 8pt Carlito",
  "italic 8pt Carlito",
  "italic bold 8pt Carlito",
];

function sameHeights(a: Record<string, number>, b: Record<string, number>) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Math.abs(a[k] - b[k]) < 0.01);
}

interface Props {
  resume: Resume;
  /** Gap between pages in px (0 for print). */
  pageGap?: number;
  onLayout?: (pages: PageLayout[]) => void;
  /** Called once fonts are loaded and pagination reflects them. */
  onReady?: () => void;
}

export function ResumeDocument({ resume, pageGap = 24, onLayout, onReady }: Props) {
  const units = useMemo(() => buildUnits(resume), [resume]);
  const unitById = useMemo(() => {
    const map: Record<string, Unit> = {};
    for (const u of [...units.left, ...units.right]) map[u.id] = u;
    return map;
  }, [units]);

  const [mounted, setMounted] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [fontEpoch, setFontEpoch] = useState(0);
  const [heights, setHeights] = useState<Record<string, number> | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const measuredEpoch = useRef(-1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target only exists after mount
    setMounted(true);
    let cancelled = false;
    const bump = () => !cancelled && setFontEpoch((e) => e + 1);
    Promise.all(FONT_PROBES.map((f) => document.fonts.load(f).catch(() => [])))
      .then(() => document.fonts.ready)
      .then(() => {
        if (cancelled) return;
        setFontsReady(true);
        bump();
      });
    document.fonts.addEventListener("loadingdone", bump);
    return () => {
      cancelled = true;
      document.fonts.removeEventListener("loadingdone", bump);
    };
  }, []);

  // Measure every unit off-screen at its column width.
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const next: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>("[data-unit-id]").forEach((el) => {
      next[el.dataset.unitId!] = el.getBoundingClientRect().height;
    });
    measuredEpoch.current = fontEpoch;
    setHeights((prev) => (prev && sameHeights(prev, next) ? prev : next));
  }, [units, mounted, fontEpoch]);

  const pages = useMemo<PageLayout[] | null>(() => {
    if (!heights) return null;
    return combineColumns(
      paginateColumn(units.left, heights, CONTENT_HEIGHT_PX, PT),
      paginateColumn(units.right, heights, CONTENT_HEIGHT_PX, PT),
    );
  }, [units, heights]);

  useEffect(() => {
    if (pages) onLayout?.(pages);
  }, [pages, onLayout]);

  const readyFired = useRef(false);
  useEffect(() => {
    if (!pages || !fontsReady || readyFired.current) return;
    if (measuredEpoch.current < 1) return;
    readyFired.current = true;
    // Let the browser paint the final layout before signalling.
    requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()));
  }, [pages, fontsReady, onReady]);

  const renderColumn = (ids: string[]) =>
    ids.map((id, i) => {
      const u = unitById[id];
      if (!u) return null;
      const space = i === 0 && u.suppressAtTop ? 0 : u.spaceBefore;
      return (
        <div key={id}>
          {space > 0 && <div style={{ height: `${space}pt` }} />}
          <div className="cv-unit">
            <ClassicUnit resume={resume} unit={u} />
          </div>
        </div>
      );
    });

  return (
    <>
      {mounted &&
        createPortal(
          <div
            ref={measureRef}
            aria-hidden
            style={{
              position: "absolute",
              left: -20000,
              top: 0,
              visibility: "hidden",
              pointerEvents: "none",
            }}
          >
            <div className="cv-page">
              {(["left", "right"] as const).map((col) => (
                <div key={col} className={`cv-col cv-col--${col}`}>
                  {units[col].map((u) => (
                    <div key={u.id} className="cv-unit" data-unit-id={u.id}>
                      <ClassicUnit resume={resume} unit={u} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {pages && (
        <div className="cv-pages" style={{ display: "flex", flexDirection: "column", gap: pageGap }}>
          {pages.map((page, i) => (
            <div key={i} className="cv-page" data-page={i}>
              <div className="cv-col cv-col--left">{renderColumn(page.left)}</div>
              <div className="cv-col cv-col--right">{renderColumn(page.right)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
