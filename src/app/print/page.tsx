import type { Metadata } from "next";
import { PrintView } from "./PrintView";

export const metadata: Metadata = { title: "Resume" };

export default function PrintPage() {
  return <PrintView />;
}
