import type { Metadata } from "next";
import { JobSettingsView } from "@/components/jobs/JobSettingsView";

export const metadata: Metadata = { title: "Job settings · CV Studio" };

export default function JobSettingsPage() {
  return <JobSettingsView />;
}
