"use client";

import { useId, useState } from "react";
import type { Locale } from "@/lib/locale";

export function FilePicker({
  name,
  accept,
  title,
  hint,
  required = false,
  locale = "en",
}: {
  name: string;
  accept: string;
  title: string;
  hint: string;
  required?: boolean;
  locale?: Locale;
}) {
  const id = useId();
  const [fileName, setFileName] = useState<string>("");
  const fi = locale === "fi";

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
        className="nodra-file-picker block cursor-pointer px-4 py-6 text-center transition active:scale-[.99]"
      >
        <span className="nodra-file-picker-icon">↑</span>
        <span className="mt-3 block text-sm font-extrabold">{fileName || title}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
          {fileName ? (fi ? "Valitse toinen tiedosto napauttamalla" : "Tap to choose another file") : hint}
        </span>
        <span className="nodra-file-picker-button">
          {fileName ? (fi ? "Vaihda tiedosto" : "Change file") : (fi ? "Valitse tiedosto" : "Choose file")}
        </span>
      </label>
    </div>
  );
}
