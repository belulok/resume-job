/**
 * Resume document model.
 *
 * Text fields are "rich text" strings using a tiny markup:
 *   **bold**   *italic*   ^superscript^   [label](https://url)   \n = line break
 */
export type RichText = string;

export type Column = "left" | "right";
export type Align = "left" | "justify";
export type TextSize = "xs" | "md";
/** disc = black "•" with hanging indent, dot = gray circle with hanging indent, inline = small gray "•" inline */
export type BulletMarker = "disc" | "dot" | "inline";

export interface Contact {
  id: string;
  label: string;
  url?: string;
}

export interface ResumeHeader {
  name: string;
  contacts: Contact[];
}

interface BlockBase {
  id: string;
  /** Extra space before this block, in pt. */
  gap?: number;
}

export interface TitleBlock extends BlockBase {
  type: "title";
  text: RichText;
  align?: Align;
}

export interface TextBlock extends BlockBase {
  type: "text";
  text: RichText;
  align?: Align;
  size?: TextSize;
  /** Left indent in pt. */
  indent?: number;
}

export interface BulletsBlock extends BlockBase {
  type: "bullets";
  items: RichText[];
  marker?: BulletMarker;
  align?: Align;
  /** Extra space between bullet items, in pt. */
  spacing?: number;
}

export interface LinkItem {
  label: string;
  url: string;
}

export interface LinksBlock extends BlockBase {
  type: "links";
  items: LinkItem[];
}

export type Block = TitleBlock | TextBlock | BulletsBlock | LinksBlock;
export type BlockType = Block["type"];

export interface Entry {
  id: string;
  /** Space before this entry in pt (overrides the section default). */
  gap?: number;
  blocks: Block[];
}

export interface Section {
  id: string;
  title: string;
  column: Column;
  hidden?: boolean;
  /** Space before the section heading, in pt. */
  gap?: number;
  /** Space between the heading and the first entry, in pt. */
  headingGap?: number;
  /** Default space between entries, in pt. */
  entryGap?: number;
  entries: Entry[];
}

export interface Resume {
  version: 1;
  template: "classic";
  title: string;
  header: ResumeHeader;
  sections: Section[];
}
