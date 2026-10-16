import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { MinimalLinenGallery } from "@/components/design-system/MinimalLinenGallery";
import "@/styles/minimal-linen.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DesignSystemPreviewPage() {
  // Accessible only in local development and Vercel Preview, never in production.
  if (process.env.NODE_ENV !== "development" && process.env.VERCEL_ENV !== "preview") notFound();
  // A preview must still require an authenticated organization member.
  await requireWorkspace();
  return <MinimalLinenGallery />;
}
