import { uid } from "./normalize";
import type { Block, BlockType, Column, Entry, Section } from "./types";

export function newBlock(type: BlockType, column: Column = "left"): Block {
  const id = uid("b");
  switch (type) {
    case "title":
      return { id, type, text: "New title" };
    case "text":
      return { id, type, text: "**Role –** *Start – End*" };
    case "bullets":
      return {
        id,
        type,
        marker: column === "left" ? "disc" : "dot",
        align: "justify",
        items: ["Describe what you did and the impact it had."],
      };
    case "links":
      return { id, type, items: [{ label: "example.com", url: "https://example.com" }] };
  }
}

/** A new entry shaped like `like` (same block types and styles) but with placeholder text. */
export function newEntryLike(like: Entry | undefined, column: Column): Entry {
  if (!like || like.blocks.length === 0) {
    return {
      id: uid("e"),
      blocks: [
        { id: uid("b"), type: "title", text: "COMPANY NAME" },
        { id: uid("b"), type: "text", text: "**Role –** *Start – End*" },
        newBlock("bullets", column),
      ],
    };
  }
  return {
    id: uid("e"),
    blocks: like.blocks.map((b): Block => {
      const id = uid("b");
      switch (b.type) {
        case "title": {
          const upper = b.text === b.text.toUpperCase();
          return { ...b, id, text: upper ? "NEW ENTRY" : "New entry" };
        }
        case "text":
          return { ...b, id, text: b.text.includes("–") ? "**Role –** *Start – End*" : "*Date*" };
        case "bullets":
          return { ...b, id, items: ["Describe what you did and the impact it had."] };
        case "links":
          return { ...b, id, items: [{ label: "example.com", url: "https://example.com" }] };
      }
    }),
  };
}

export function newSection(column: Column): Section {
  return {
    id: uid("s"),
    title: "NEW SECTION",
    column,
    entries: [newEntryLike(undefined, column)],
  };
}
