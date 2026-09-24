import { UploadPanel } from "@/components/UploadPanel";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="kicker">Ingestion</div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Upload an RFQ and product catalogue.</h1>
      <p className="mt-2 mb-7 max-w-2xl text-sm leading-6 text-[var(--muted)]">The first Rivora milestone deliberately starts with files. Reliable matching matters more than live ERP write-back.</p>
      <UploadPanel />
    </div>
  );
}
