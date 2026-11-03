"use client";

import { useCallback } from "react";
import { saveDraft } from "@/lib/storage";
import { useEditor } from "@/store/editor-store";

/**
 * Persist the current document: the base resume goes to ./data/resume.json
 * (and the local draft), a tailored resume goes back into its job file.
 */
export function useSave() {
  return useCallback(async () => {
    const { resume, doc, setSaving, markSaved } = useEditor.getState();
    setSaving(true);
    try {
      let res: Response;
      if (doc.kind === "job") {
        res = await fetch(`/api/jobs/${encodeURIComponent(doc.jobId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume }),
        });
      } else {
        saveDraft(resume);
        res = await fetch("/api/resume", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume }),
        });
      }
      if (!res.ok) throw new Error(res.statusText);
      markSaved(JSON.stringify(resume));
    } catch (e) {
      console.error("Save failed", e);
      setSaving(false);
      alert(
        doc.kind === "job"
          ? "Saving the tailored CV failed — is the dev server running?"
          : "Saving failed — your changes are still kept in this browser.",
      );
    }
  }, []);
}
