import { stripRich } from "@/lib/resume/richtext";
import type { Resume } from "@/lib/resume/types";
import type { PageLayout } from "@/lib/resume/units";
import { setPrintPayload } from "@/lib/storage";

export function filenameFor(resume: Resume, ext: string) {
  const base = (resume.title || "resume").replace(/[^\w\- .]+/g, "").trim() || "resume";
  return `${base}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Vector PDF rendered by headless Chrome on the dev server; falls back to the browser print dialog. */
export async function exportPdf(resume: Resume): Promise<"downloaded" | "print-dialog"> {
  try {
    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resume),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
    downloadBlob(await res.blob(), filenameFor(resume, "pdf"));
    return "downloaded";
  } catch (e) {
    console.warn("Server PDF export failed, falling back to print dialog:", e);
    printResume(resume);
    return "print-dialog";
  }
}

/** Opens the print view and triggers the browser print dialog. */
export function printResume(resume: Resume) {
  setPrintPayload(resume);
  window.open("/print?auto=1", "_blank", "noopener");
}

export async function exportDocx(resume: Resume, layout: PageLayout[]) {
  const { buildDocx } = await import("./docx");
  downloadBlob(await buildDocx(resume, layout), filenameFor(resume, "docx"));
}

export function exportJson(resume: Resume) {
  downloadBlob(
    new Blob([JSON.stringify(resume, null, 2)], { type: "application/json" }),
    filenameFor(resume, "json"),
  );
}

export function resumeToText(resume: Resume): string {
  const lines: string[] = [resume.header.name, ...resume.header.contacts.map((c) => c.label), ""];
  const ordered = [
    ...resume.sections.filter((s) => s.column === "left"),
    ...resume.sections.filter((s) => s.column === "right"),
  ].filter((s) => !s.hidden);

  for (const section of ordered) {
    lines.push(section.title.toUpperCase(), "-".repeat(Math.min(section.title.length, 40)));
    section.entries.forEach((entry, ei) => {
      if (ei > 0) lines.push("");
      for (const block of entry.blocks) {
        switch (block.type) {
          case "title":
          case "text":
            lines.push(stripRich(block.text));
            break;
          case "bullets":
            for (const item of block.items) lines.push(`• ${stripRich(item)}`);
            break;
          case "links":
            for (const item of block.items) lines.push(item.url || item.label);
            break;
        }
      }
    });
    lines.push("");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function exportText(resume: Resume) {
  downloadBlob(new Blob([resumeToText(resume)], { type: "text/plain" }), filenameFor(resume, "txt"));
}
