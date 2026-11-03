import type { Metadata } from "next";
import { JobsView } from "@/components/jobs/JobsView";

export const metadata: Metadata = { title: "Jobs · CV Studio" };

export default function JobsPage() {
  return <JobsView />;
}
