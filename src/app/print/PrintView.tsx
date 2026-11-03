"use client";

import { useCallback, useEffect, useState } from "react";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { defaultResume } from "@/lib/resume/default-resume";
import { normalizeResume } from "@/lib/resume/normalize";
import type { Resume } from "@/lib/resume/types";
import { loadDraft, takePrintPayload } from "@/lib/storage";

declare global {
  interface Window {
    __RESUME__?: unknown;
    __PRINT_READY__?: boolean;
  }
}

/** Bare page renderer used by the PDF exporter (headless Chrome) and the browser print fallback. */
export function PrintView() {
  const [resume, setResume] = useState<Resume | null>(null);

  useEffect(() => {
    const source = window.__RESUME__ ?? takePrintPayload() ?? loadDraft() ?? defaultResume;
    const next = normalizeResume(source);
    document.title = next.title || "Resume";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data only exists on the client
    setResume(next);
  }, []);

  const onReady = useCallback(() => {
    window.__PRINT_READY__ = true;
    if (new URLSearchParams(window.location.search).has("auto")) window.print();
  }, []);

  if (!resume) return null;
  return (
    <div className="print-root">
      <ResumeDocument resume={resume} pageGap={0} onReady={onReady} />
    </div>
  );
}
