import type { Column, Resume } from "./types";

/**
 * A "unit" is the smallest thing pagination moves between pages: the header,
 * or one entry (the first entry of a section carries the section heading so a
 * heading is never orphaned at the bottom of a page).
 */
export interface Unit {
  id: string;
  column: Column;
  kind: "header" | "entry";
  sectionIndex: number;
  /** -1 for a section that has a heading but no entries yet. */
  entryIndex: number;
  withHeading: boolean;
  /** Space above the unit in pt. */
  spaceBefore: number;
  /** Drop `spaceBefore` when the unit starts a page (section starts do). */
  suppressAtTop: boolean;
}

export const SPACING = {
  sectionGap: { left: 18, right: 14 },
  headingGap: { left: 14, right: 7 },
  entryGap: { left: 10, right: 10 },
} as const;

export function buildUnits(resume: Resume): Record<Column, Unit[]> {
  const out: Record<Column, Unit[]> = {
    left: [
      {
        id: "header",
        column: "left",
        kind: "header",
        sectionIndex: -1,
        entryIndex: -1,
        withHeading: false,
        spaceBefore: 0,
        suppressAtTop: false,
      },
    ],
    right: [],
  };

  resume.sections.forEach((section, si) => {
    if (section.hidden) return;
    const col = section.column;
    const sectionGap = section.gap ?? SPACING.sectionGap[col];
    const entryGap = section.entryGap ?? SPACING.entryGap[col];
    if (section.entries.length === 0) {
      out[col].push({
        id: `${section.id}:heading`,
        column: col,
        kind: "entry",
        sectionIndex: si,
        entryIndex: -1,
        withHeading: true,
        spaceBefore: sectionGap,
        suppressAtTop: true,
      });
      return;
    }
    section.entries.forEach((entry, ei) => {
      const first = ei === 0;
      out[col].push({
        id: `${section.id}:${entry.id}`,
        column: col,
        kind: "entry",
        sectionIndex: si,
        entryIndex: ei,
        withHeading: first,
        spaceBefore: first ? sectionGap : (entry.gap ?? entryGap),
        suppressAtTop: first,
      });
    });
  });

  return out;
}

export interface PageLayout {
  left: string[];
  right: string[];
}

/** Greedy pagination: keep units whole, start a new page when the next one doesn't fit. */
export function paginateColumn(
  units: Unit[],
  heights: Record<string, number>,
  pageHeight: number,
  ptToPx: number,
): string[][] {
  const pages: string[][] = [[]];
  let used = 0;
  for (const u of units) {
    const h = heights[u.id] ?? 0;
    const space = u.spaceBefore * ptToPx;
    const page = pages[pages.length - 1];
    if (page.length === 0) {
      page.push(u.id);
      used = (u.suppressAtTop ? 0 : space) + h;
    } else if (used + space + h <= pageHeight + 0.5) {
      page.push(u.id);
      used += space + h;
    } else {
      pages.push([u.id]);
      used = (u.suppressAtTop ? 0 : space) + h;
    }
  }
  return pages;
}

export function combineColumns(left: string[][], right: string[][]): PageLayout[] {
  const n = Math.max(left.length, right.length, 1);
  return Array.from({ length: n }, (_, i) => ({
    left: left[i] ?? [],
    right: right[i] ?? [],
  }));
}
