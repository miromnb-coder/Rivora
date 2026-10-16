"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

function cls(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export type MlButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type MlTone = "neutral" | "success" | "warning" | "danger" | "info";

export type MlButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: MlButtonVariant;
  loading?: boolean;
};
export function MlButton({
  variant = "primary",
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: MlButtonProps) {
  return (
    <button
      {...rest}
      className={cls("ml-button", "ml-button--" + variant, className)}
      disabled={Boolean(disabled || loading)}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ml-spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export type MlTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  hint?: string;
  error?: string;
};
export function MlTextField({
  label, hint, error, id: suppliedId, className, ...rest
}: MlTextFieldProps) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const description = [
    rest["aria-describedby"],
    error ? id + "-error" : hint ? id + "-hint" : "",
  ].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ml-field">
      <label className="ml-label" htmlFor={id}>{label}</label>
      <input
        {...rest}
        id={id}
        className={cls("ml-input", className)}
        aria-invalid={error ? true : rest["aria-invalid"]}
        aria-describedby={description}
      />
      {error
        ? <span className="ml-field-error" id={id + "-error"}>{error}</span>
        : hint ? <span className="ml-field-hint" id={id + "-hint"}>{hint}</span> : null}
    </div>
  );
}

export type MlTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};
export function MlTextareaField({ label, hint, error, id: suppliedId, className, ...rest }: MlTextareaProps) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const description = [
    rest["aria-describedby"],
    error ? id + "-error" : hint ? id + "-hint" : "",
  ].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ml-field">
      <label className="ml-label" htmlFor={id}>{label}</label>
      <textarea
        {...rest}
        id={id}
        className={cls("ml-textarea", className)}
        aria-invalid={error ? true : rest["aria-invalid"]}
        aria-describedby={description}
      />
      {error
        ? <span className="ml-field-error" id={id + "-error"}>{error}</span>
        : hint ? <span className="ml-field-hint" id={id + "-hint"}>{hint}</span> : null}
    </div>
  );
}

export type MlSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  hint?: string;
  error?: string;
};
export function MlSelectField({
  label, options, hint, error, id: suppliedId, className, ...rest
}: MlSelectProps) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const description = [
    rest["aria-describedby"],
    error ? id + "-error" : hint ? id + "-hint" : "",
  ].filter(Boolean).join(" ") || undefined;
  return (
    <div className="ml-field">
      <label className="ml-label" htmlFor={id}>{label}</label>
      <select
        {...rest}
        id={id}
        className={cls("ml-select", className)}
        aria-invalid={error ? true : rest["aria-invalid"]}
        aria-describedby={description}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {error
        ? <span className="ml-field-error" id={id + "-error"}>{error}</span>
        : hint ? <span className="ml-field-hint" id={id + "-hint"}>{hint}</span> : null}
    </div>
  );
}

export type MlCardProps = HTMLAttributes<HTMLDivElement> & { soft?: boolean };
export function MlCard({ soft = false, className, ...props }: MlCardProps) {
  return <div {...props} className={cls("ml-card", soft && "ml-card--soft", className)} />;
}

export function MlStatusBadge({ tone = "neutral", children }: { tone?: MlTone; children: ReactNode }) {
  return <span className={cls("ml-badge", tone !== "neutral" && "ml-badge--" + tone)}>{children}</span>;
}

export function MlAlert({
  tone = "neutral", title, children,
}: { tone?: "neutral" | "success" | "warning" | "danger"; title?: string; children: ReactNode }) {
  return (
    <div className={cls("ml-alert", tone !== "neutral" && "ml-alert--" + tone)} role={tone === "danger" ? "alert" : "status"}>
      {title ? <p className="ml-alert-title">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

export function MlCheckbox({ children, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode }) {
  return (
    <label className="ml-checkbox-row">
      <input {...props} type="checkbox" className={cls("ml-checkbox", props.className)} />
      <span>{children}</span>
    </label>
  );
}

export type MlTabItem = { id: string; label: string; content: ReactNode };
export function MlTabs({ label, items, defaultValue }: {
  label: string; items: ReadonlyArray<MlTabItem>; defaultValue?: string;
}) {
  const [active, setActive] = useState(defaultValue || items[0]?.id || "");
  const prefix = useId();
  const selected = items.some((item) => item.id === active) ? active : items[0]?.id;
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!items.length) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    setActive(items[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  return (
    <div>
      <div className="ml-tabs" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="ml-tab"
            role="tab"
            id={prefix + "-tab-" + index}
            aria-selected={selected === item.id}
            aria-controls={prefix + "-panel-" + index}
            tabIndex={selected === item.id ? 0 : -1}
            onClick={() => setActive(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >{item.label}</button>
        ))}
      </div>
      {items.map((item, index) =>
        selected === item.id ? (
          <section
            key={item.id}
            className="ml-tab-panel"
            role="tabpanel"
            tabIndex={0}
            id={prefix + "-panel-" + index}
            aria-labelledby={prefix + "-tab-" + index}
          >{item.content}</section>
        ) : null
      )}
    </div>
  );
}

export type MlTableColumn = { key: string; label: string; right?: boolean };
export function MlDataTable({
  label, columns, rows, emptyText = "Ei tietoja.",
}: {
  label: string;
  columns: ReadonlyArray<MlTableColumn>;
  rows: ReadonlyArray<Record<string, ReactNode>>;
  emptyText?: string;
}) {
  return (
    <div className="ml-table-scroll" tabIndex={0} role="region" aria-label={label}>
      <table className="ml-table">
        <thead><tr>{columns.map((col) => (
          <th scope="col" key={col.key} className={col.right ? "ml-align-right" : undefined}>{col.label}</th>
        ))}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={Math.max(1, columns.length)}>{emptyText}</td></tr>
          ) : rows.map((row, index) => (
            <tr key={typeof row.id === "string" || typeof row.id === "number" ? row.id : index}>
              {columns.map((col) => (
                <td key={col.key} className={col.right ? "ml-align-right" : undefined}>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MlEmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="ml-empty"><h3 className="ml-card-heading">{title}</h3><p className="ml-muted">{children}</p></div>;
}

export function MlSkeleton({ width = "100%", height = "16px" }: { width?: string; height?: string }) {
  return <span className="ml-skeleton" aria-hidden="true" style={{ width, height }} />;
}

export function MlDialog({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return (
    <dialog ref={dialog} className="ml-dialog" aria-labelledby={titleId} onClose={onClose}>
      <div className="ml-dialog-head">
        <h2 className="ml-subheading" id={titleId}>{title}</h2>
        <button type="button" className="ml-dialog-close" aria-label="Sulje" onClick={onClose}>×</button>
      </div>
      {children}
    </dialog>
  );
}
