import { Fragment, memo } from "react";
import { parseRich } from "@/lib/resume/richtext";
import type { Block, Resume } from "@/lib/resume/types";
import { SPACING, type Unit } from "@/lib/resume/units";

/**
 * Classic two-column template — a 1:1 recreation of "Sebastian resume Jan 2026.pdf".
 * US Letter, Calibri 8pt body, Verdana 16pt name, 12pt bold headings
 * (ruled in the left column), independent left/right column flow.
 */
export const CLASSIC = {
  id: "classic",
  name: "Classic · Two column",
  pageWidthPt: 612,
  pageHeightPt: 792,
  /** Vertical space available to a column on one page. */
  contentHeightPt: 792 - 16 - 18,
} as const;

export const RichTextView = memo(function RichTextView({ text }: { text: string }) {
  const spans = parseRich(text);
  return (
    <>
      {spans.map((s, i) => {
        if (s.br) return <br key={i} />;
        let node: React.ReactNode = s.text;
        if (s.sup) node = <sup>{node}</sup>;
        if (s.italic) node = <em>{node}</em>;
        if (s.bold) node = <strong>{node}</strong>;
        if (s.href) {
          node = (
            <a className="cv-link cv-link--plain" href={s.href} target="_blank" rel="noreferrer">
              {node}
            </a>
          );
        }
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
});

function BlockView({ block, path }: { block: Block; path: string }) {
  const style: React.CSSProperties = block.gap ? { marginTop: `${block.gap}pt` } : {};
  const align = "align" in block && block.align === "justify" ? " cv-justify" : "";

  switch (block.type) {
    case "title":
      return (
        <div className={`cv-block cv-title${align}`} style={style} data-path={path}>
          <RichTextView text={block.text} />
        </div>
      );
    case "text":
      return (
        <div
          className={`cv-block cv-text${block.size === "xs" ? " cv-text--xs" : ""}${align}`}
          style={{ ...style, ...(block.indent ? { paddingLeft: `${block.indent}pt` } : {}) }}
          data-path={path}
        >
          <RichTextView text={block.text} />
        </div>
      );
    case "bullets":
      return (
        <ul
          className={`cv-block cv-bullets cv-bullets--${block.marker ?? "disc"}${align}`}
          style={style}
          data-path={path}
        >
          {block.items.map((item, i) => (
            <li
              key={i}
              className="cv-bullet"
              style={i > 0 && block.spacing ? { marginTop: `${block.spacing}pt` } : undefined}
              data-path={`${path}/items/${i}`}
            >
              <span className="cv-bullet__mark" aria-hidden />
              <RichTextView text={item} />
            </li>
          ))}
        </ul>
      );
    case "links":
      return (
        <div className="cv-block cv-links" style={style} data-path={path}>
          {block.items.map((item, i) => (
            <a
              key={i}
              className="cv-link cv-links__item"
              href={item.url}
              target="_blank"
              rel="noreferrer"
              data-path={`${path}/items/${i}`}
            >
              {item.label || item.url}
            </a>
          ))}
        </div>
      );
  }
}

function HeaderView({ resume }: { resume: Resume }) {
  const { header } = resume;
  return (
    <div className="cv-header" data-path="/header">
      <div className="cv-name" data-path="/header/name">
        {header.name}
      </div>
      {header.contacts.map((c, i) =>
        c.url ? (
          <a
            key={c.id}
            className="cv-link cv-contact"
            href={c.url}
            data-path={`/header/contacts/${i}`}
          >
            {c.label}
          </a>
        ) : (
          <div key={c.id} className="cv-contact" data-path={`/header/contacts/${i}`}>
            {c.label}
          </div>
        ),
      )}
    </div>
  );
}

export const ClassicUnit = memo(function ClassicUnit({
  resume,
  unit,
}: {
  resume: Resume;
  unit: Unit;
}) {
  if (unit.kind === "header") return <HeaderView resume={resume} />;

  const si = unit.sectionIndex;
  const section = resume.sections[si];
  if (!section) return null;
  const entry = unit.entryIndex >= 0 ? section.entries[unit.entryIndex] : null;
  const entryPath = `/sections/${si}/entries/${unit.entryIndex}`;
  const headingGap = section.headingGap ?? SPACING.headingGap[section.column];

  return (
    <>
      {unit.withHeading && (
        <div className="cv-heading" data-path={`/sections/${si}`}>
          {section.title}
        </div>
      )}
      {entry && (
        <div
          className="cv-entry"
          data-path={entryPath}
          style={unit.withHeading ? { paddingTop: `${headingGap}pt` } : undefined}
        >
          {entry.blocks.map((b, bi) => (
            <BlockView key={b.id} block={b} path={`${entryPath}/blocks/${bi}`} />
          ))}
        </div>
      )}
    </>
  );
});
