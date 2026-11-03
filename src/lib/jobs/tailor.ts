import { z } from "zod";
import { OperationSchema, RESUME_MODEL_DOC } from "@/lib/ai/prompt";
import { runStructured } from "@/lib/ai/provider";
import { applyOps, type PatchOp } from "@/lib/resume/patch";
import type { Resume } from "@/lib/resume/types";
import { indexText, keywordMatches, resumePlainText, scoreResume } from "./score";
import type { Job, JobKeyword } from "./types";

const TailorSchema = z.object({
  reply: z.string(),
  operations: z.array(OperationSchema),
  gaps: z.array(z.string()),
});

const TAILOR_SYSTEM = `You tailor a candidate's resume to one specific job so it scores highly in an applicant tracking system (ATS), while staying 100% truthful.

The score is literal keyword coverage: the weighted share of the job's ATS keywords (or their aliases) that appear somewhere in the resume text. You change the resume by returning edit operations.

${RESUME_MODEL_DOC}

## How to tailor
- Work through the MISSING keywords, heaviest weight first. For each one, find real evidence in the resume or the candidate's extra facts and surface the keyword using the job's exact spelling:
  - rephrase an existing bullet that describes that work so it uses the keyword naturally (preferred);
  - add the skill/tool to the right TECHNICAL SKILLS line ("Proficient with" or "Familiar with") when the resume or facts show the candidate has used it — e.g. "Docker" when "Dockers" is listed, "REST APIs" when bullets describe RESTful APIs, "LLM" when they built LLM services;
  - soft skills (communication, mentoring, stakeholder management, …) may be woven into bullets whose work clearly shows them.
- Reorder bullets inside an entry so the most relevant to this job come first.
- Keep everything that is already matched. Keep bold on key phrases and keep the house style.
- Keep length roughly constant (the resume must stay within 3 pages): add at most 3 new bullets in total, and you may tighten bullets that are irrelevant to this job.

## Never
- Invent or change employers, job titles, dates, education, certifications, awards, links or metrics.
- Claim a skill, tool, language or domain the candidate has no evidence for. Put such keywords in "gaps" instead — an honest 80% beats a fabricated 100%.
- Change section titles, columns, the header, or the overall structure.

"reply": 1–2 sentences summarising what you changed. "gaps": missing keywords you could not add truthfully.`;

function keywordTable(keywords: JobKeyword[], resume: Resume) {
  const index = indexText(resumePlainText(resume));
  return [...keywords]
    .sort((a, b) => b.weight - a.weight)
    .map((k) => {
      const status = keywordMatches(index, k) ? "MATCHED" : "MISSING";
      const aliases = k.aliases.length ? ` (aliases: ${k.aliases.join(", ")})` : "";
      return `- [${status}] weight ${k.weight} · ${k.term}${aliases}`;
    })
    .join("\n");
}

export interface TailorResult {
  resume: Resume;
  score: number;
  matched: string[];
  missing: string[];
  gaps: string[];
  notes: string;
  rounds: number;
}

export async function tailorResume(
  base: Resume,
  job: Pick<Job, "title" | "company" | "description" | "keywords">,
  opts: { targetScore: number; extraFacts: string; maxRounds?: number },
): Promise<TailorResult> {
  const maxRounds = opts.maxRounds ?? 3;
  let best: TailorResult = {
    resume: base,
    ...scoreResume(base, job.keywords),
    gaps: [],
    notes: "",
    rounds: 0,
  };
  let current = base;
  let gaps: string[] = [];
  const notes: string[] = [];

  for (let round = 1; round <= maxRounds; round++) {
    const before = scoreResume(current, job.keywords);
    if (before.score >= opts.targetScore && round > 1) break;

    const user = [
      `<job title="${job.title}"${job.company ? ` company="${job.company}"` : ""}>\n${job.description.slice(0, 12000)}\n</job>`,
      `<ats_keywords current_score="${before.score}%" target="${opts.targetScore}%">\n${keywordTable(job.keywords, current)}\n</ats_keywords>`,
      opts.extraFacts.trim()
        ? `<extra_facts_about_candidate>\n${opts.extraFacts.trim()}\n</extra_facts_about_candidate>`
        : "",
      gaps.length ? `<previous_gaps>${gaps.join(", ")}</previous_gaps>` : "",
      `<resume_json>\n${JSON.stringify(current)}\n</resume_json>`,
      round === 1
        ? "Tailor this resume for the job."
        : `Round ${round}: the score is ${before.score}%. Cover the remaining MISSING keywords where there is real evidence; otherwise list them in gaps.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const out = await runStructured({ system: TAILOR_SYSTEM, user, schema: TailorSchema, effort: "medium" });
    const ops: PatchOp[] = out.operations.map((o) => ({
      op: o.op,
      path: o.path,
      from: o.from || undefined,
      value: o.value || undefined,
    }));
    const applied = applyOps(current, ops);
    current = applied.resume;
    gaps = out.gaps;
    if (out.reply) notes.push(out.reply);

    const after = scoreResume(current, job.keywords);
    if (after.score >= best.score) {
      best = { resume: current, ...after, gaps, notes: notes.join(" "), rounds: round };
    }
    // Stop when the model has nothing more it can truthfully add.
    if (after.score <= before.score || !applied.applied.length) break;
  }

  // Gaps are only meaningful for keywords that are still missing.
  const missing = new Set(best.missing.map((m) => m.toLowerCase()));
  best.gaps = [...new Set([...best.gaps.filter((g) => missing.has(g.toLowerCase())), ...best.missing])];
  return best;
}
