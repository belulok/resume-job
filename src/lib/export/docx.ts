import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ParagraphChild,
} from "docx";
import { parseRich } from "@/lib/resume/richtext";
import type { Block, Column, Resume } from "@/lib/resume/types";
import { buildUnits, SPACING, type PageLayout, type Unit } from "@/lib/resume/units";

/*
 * Word export of the Classic template. Each preview page becomes one Word
 * section holding a borderless 3-column table (left column / gutter / right
 * column), so Word keeps the same page breaks as the on-screen layout.
 */

const TW = 20; // twips per pt
const BODY_FONT = "Calibri";
const NAME_FONT = "Verdana";
const hp = (pt: number) => Math.round(pt * 2); // half-points

const COL = { left: 348, gutter: 36, right: 162 };
const MARGIN = { top: 16, bottom: 18, left: 40, right: 612 - 40 - COL.left - COL.gutter - COL.right };
const ENTRY_INDENT: Record<Column, { left: number; right: number }> = {
  left: { left: 14, right: 10 },
  right: { left: 0, right: 0 },
};

interface RunStyle {
  size?: number;
  bold?: boolean;
  italics?: boolean;
  font?: string;
  color?: string;
}

function richRuns(text: string, base: RunStyle = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  const size = hp(base.size ?? 8);
  for (const span of parseRich(text)) {
    if (span.br) {
      out.push(new TextRun({ text: "", break: 1, size, font: base.font ?? BODY_FONT }));
      continue;
    }
    const run = new TextRun({
      text: span.text,
      bold: base.bold || span.bold,
      italics: base.italics || span.italic,
      superScript: span.sup,
      size,
      font: base.font ?? BODY_FONT,
      color: base.color,
    });
    out.push(span.href ? new ExternalHyperlink({ link: span.href, children: [run] }) : run);
  }
  return out;
}

interface ParaOpts {
  before?: number;
  indentLeft?: number;
  indentRight?: number;
  hanging?: number;
  justify?: boolean;
  border?: boolean;
  lineMultiple?: number;
}

function para(children: ParagraphChild[], o: ParaOpts = {}) {
  return new Paragraph({
    children,
    alignment: o.justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    spacing: { before: Math.round((o.before ?? 0) * TW), after: 0, line: Math.round(240 * (o.lineMultiple ?? 1)) },
    indent: {
      left: Math.round((o.indentLeft ?? 0) * TW),
      right: Math.round((o.indentRight ?? 0) * TW),
      ...(o.hanging ? { hanging: Math.round(o.hanging * TW) } : {}),
    },
    border: o.border
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: "262626", space: 1 } }
      : undefined,
  });
}

function blockParagraphs(block: Block, column: Column, firstBefore: number): Paragraph[] {
  const ind = ENTRY_INDENT[column];
  const before = firstBefore + (block.gap ?? 0);
  const justify = "align" in block && block.align === "justify";

  switch (block.type) {
    case "title":
      return [para(richRuns(block.text, { bold: true }), { before, indentLeft: ind.left, indentRight: ind.right, justify })];
    case "text": {
      const xs = block.size === "xs";
      return [
        para(richRuns(block.text, { size: xs ? 5.5 : 8 }), {
          before,
          indentLeft: ind.left + (block.indent ?? 0),
          indentRight: ind.right,
          justify,
        }),
      ];
    }
    case "bullets": {
      const marker = block.marker ?? "disc";
      return block.items.map((item, i) => {
        const b = i === 0 ? before : (block.spacing ?? 0);
        if (marker === "inline") {
          return para(
            [new TextRun({ text: "• ", size: hp(6.5), color: "9B9B9B", font: BODY_FONT }), ...richRuns(item)],
            { before: b, indentLeft: ind.left, indentRight: ind.right, justify },
          );
        }
        const mark =
          marker === "dot"
            ? new TextRun({ text: "●", size: hp(5.5), color: "7F7F7F", font: "Arial" })
            : new TextRun({ text: "•", size: hp(8), font: BODY_FONT });
        return para([mark, new TextRun({ text: "\t", size: hp(8) }), ...richRuns(item)], {
          before: b,
          indentLeft: ind.left + 19,
          hanging: 16,
          indentRight: ind.right,
          justify,
        });
      });
    }
    case "links":
      return block.items.map((item, i) =>
        para(
          [
            new ExternalHyperlink({
              link: item.url,
              children: [new TextRun({ text: item.label || item.url, underline: {}, size: hp(8), font: BODY_FONT })],
            }),
          ],
          { before: i === 0 ? before : 0, indentLeft: ind.left, lineMultiple: 1.08 },
        ),
      );
  }
}

function unitParagraphs(resume: Resume, unit: Unit, firstOnPage: boolean): Paragraph[] {
  const space = firstOnPage && unit.suppressAtTop ? 0 : unit.spaceBefore;

  if (unit.kind === "header") {
    const { header } = resume;
    return [
      para([new TextRun({ text: header.name, font: NAME_FONT, size: hp(16) })], { before: space + 12, indentLeft: 9 }),
      ...header.contacts.map((c) =>
        para(
          [
            c.url
              ? new ExternalHyperlink({
                  link: c.url,
                  children: [new TextRun({ text: c.label, underline: {}, size: hp(8), font: BODY_FONT })],
                })
              : new TextRun({ text: c.label, size: hp(8), font: BODY_FONT }),
          ],
          { indentLeft: 9 },
        ),
      ),
    ];
  }

  const section = resume.sections[unit.sectionIndex];
  const col = section.column;
  const out: Paragraph[] = [];
  let nextBefore = space;
  if (unit.withHeading) {
    out.push(
      para([new TextRun({ text: section.title, bold: true, size: hp(12), font: BODY_FONT })], {
        before: space,
        indentLeft: col === "left" ? 3 : 0,
        border: col === "left",
      }),
    );
    nextBefore = section.headingGap ?? SPACING.headingGap[col];
  }
  const entry = section.entries[unit.entryIndex];
  entry?.blocks.forEach((block, i) => {
    out.push(...blockParagraphs(block, col, i === 0 ? nextBefore : 0));
  });
  return out;
}

function cell(width: number, children: Paragraph[]) {
  return new TableCell({
    width: { size: width * TW, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: children.length ? children : [new Paragraph({})],
  });
}

export async function buildDocx(resume: Resume, layout: PageLayout[]): Promise<Blob> {
  const units = buildUnits(resume);
  const byId: Record<string, Unit> = {};
  for (const u of [...units.left, ...units.right]) byId[u.id] = u;

  // Fall back to a single page if the preview hasn't produced a layout yet.
  const pages: PageLayout[] = layout.length
    ? layout
    : [{ left: units.left.map((u) => u.id), right: units.right.map((u) => u.id) }];

  const column = (ids: string[]) =>
    ids.flatMap((id, i) => (byId[id] ? unitParagraphs(resume, byId[id], i === 0) : []));

  const doc = new Document({
    creator: "CV Studio",
    title: resume.title,
    styles: {
      default: { document: { run: { font: BODY_FONT, size: hp(8) } } },
    },
    sections: pages.map((page) => ({
      properties: {
        page: {
          size: { width: 612 * TW, height: 792 * TW },
          margin: {
            top: MARGIN.top * TW,
            bottom: MARGIN.bottom * TW,
            left: MARGIN.left * TW,
            right: MARGIN.right * TW,
            header: 0,
            footer: 0,
          },
        },
      },
      children: [
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: (COL.left + COL.gutter + COL.right) * TW, type: WidthType.DXA },
          columnWidths: [COL.left * TW, COL.gutter * TW, COL.right * TW],
          borders: TableBorders.NONE,
          rows: [
            new TableRow({
              children: [
                cell(COL.left, column(page.left)),
                cell(COL.gutter, []),
                cell(COL.right, column(page.right)),
              ],
            }),
          ],
        }),
      ],
    })),
  });

  return Packer.toBlob(doc);
}
