"use client";

import { useId, useState } from "react";

export function FilePicker({
  name,
  accept,
  title,
  hint,
  required = false,
}: {
  name: string;
  accept: string;
  title: string;
  hint: string;
  required?: boolean;
}) {
  const id = useId();
  const [fileName, setFileName] = useState<string>("");

  return (
    <div className="mt-4">
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
      />
      <label
        htmlFor={id}
        className="block cursor-pointer rounded-2xl border-2 border-dashed border-[#cbd5ce] bg-[#fafcfb] px-4 py-6 text-center transition active:scale-[.99] hover:border-[var(--green)] hover:bg-[#f6faf7]"
      >
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--green-soft)] text-xl font-extrabold text-[var(--green)]">
          ↑
        </span>
        <span className="mt-3 block text-sm font-extrabold">
          {fileName || title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
          {fileName ? "Tap to choose another file" : hint}
        </span>
        <span className="mx-auto mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold shadow-sm">
          {fileName ? "Change file" : "Choose file"}
        </span>
      </label>
    </div>
  );
}
