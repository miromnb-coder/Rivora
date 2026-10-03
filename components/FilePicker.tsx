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
  variant = "default",
}: {
  name: string;
  accept: string;
  title: string;
  hint: string;
  required?: boolean;
  locale?: Locale;
  variant?: "default" | "compact";
}) {
  const id = useId();
  const [fileName, setFileName] = useState<string>("");
  const fi = locale === "fi";
  const compact = variant === "compact";

  return (
    <div className={`file-picker mt-4${compact ? " file-picker--compact" : ""}`}>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="sr-only upload-file-input"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
      />
      <label
        htmlFor={id}
        className={
          "nodra-file-picker block cursor-pointer px-4 text-center transition " +
          (compact ? "py-4" : "py-6 active:scale-[.99]")
        }
      >
        <span className="nodra-file-picker-icon">↑</span>
        <span className={`mt-3 block text-sm ${compact ? "font-semibold" : "font-extrabold"}`}>
          {fileName || title}
        </span>
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
