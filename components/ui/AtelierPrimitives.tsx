import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`ap-button ap-button-primary ${className}`} {...props} />;
}
export function SecondaryButton({ className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`ap-button ap-button-secondary ${className}`} {...props} />;
}
export function TextButton({ className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`ap-button ap-button-text ${className}`} {...props} />;
}
export function IconButton({ label, className = "", type = "button", ...props }: ButtonProps & { label: string }) {
  return <button type={type} aria-label={label} className={`ap-button ap-icon-button ${className}`} {...props} />;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; help?: string; error?: string };
export function FormField({ id, label, help, error, className = "", ...input }: FieldProps) {
  const description = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className={`ap-field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <input {...input} id={id} aria-invalid={error ? true : undefined} aria-describedby={description} />
    {help && <small id={`${id}-help`}>{help}</small>}
    {error && <small id={`${id}-error`} className="ap-field-error">{error}</small>}
  </div>;
}
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; help?: string; error?: string; children: ReactNode };
export function SelectField({ id, label, help, error, children, className = "", ...select }: SelectProps) {
  const description = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className={`ap-field ${className}`}>
    <label htmlFor={id}>{label}</label>
    <select {...select} id={id} aria-invalid={error ? true : undefined} aria-describedby={description}>{children}</select>
    {help && <small id={`${id}-help`}>{help}</small>}
    {error && <small id={`${id}-error`} className="ap-field-error">{error}</small>}
  </div>;
}

export type StatusTone = "open" | "suggested" | "review" | "success" | "info" | "locked" | "error" | "unknown";
/** The caller supplies the authoritative domain label; tone has no business meaning. */
export function StatusBadge({ children, tone = "unknown", className = "" }: { children: ReactNode; tone?: StatusTone; className?: string }) {
  return <span className={`ap-status ap-status-${tone} ${className}`}><span aria-hidden="true" className="ap-status-dot" />{children}</span>;
}
export function DataTable({ caption, children, className = "" }: { caption: string; children: ReactNode; className?: string }) {
  return <div className={`ap-table-scroll ${className}`} role="region" aria-label={caption} tabIndex={0}>
    <table className="ap-table"><caption>{caption}</caption>{children}</table>
  </div>;
}
export function TableToolbar({ children, count }: { children?: ReactNode; count?: ReactNode }) {
  return <div className="ap-table-toolbar">{count && <span>{count}</span>}{children && <div>{children}</div>}</div>;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="ap-state"><h2>{title}</h2>{children && <p>{children}</p>}{action}</section>;
}
export function ErrorState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <section className="ap-state ap-state-error"><h2>{title}</h2>{children && <p>{children}</p>}{action}</section>;
}
export function LoadingState({ label }: { label: string }) {
  return <div className="ap-state ap-state-loading" role="status" aria-label={label}><span className="ap-loading-line" /><span className="ap-loading-line" /><span className="ap-loading-line" /><span className="sr-only">{label}</span></div>;
}
export function InlineAlert({ tone = "info", children }: { tone?: "info" | "review" | "error" | "success"; children: ReactNode }) {
  return <div className={`ap-alert ap-alert-${tone}`}>{children}</div>;
}

export type Crumb = { label: string; href?: string };
export function Breadcrumbs({ items, label }: { items: readonly Crumb[]; label: string }) {
  return <nav className="ap-breadcrumbs" aria-label={label}><ol>{items.map((item, i) => <li key={`${item.href ?? "current"}-${i}`}>
    {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
  </li>)}</ol></nav>;
}
export function PageHeader({ eyebrow, title, description, status, action, breadcrumbs, breadcrumbLabel, className = "" }: {
  eyebrow?: string; title: ReactNode; description?: ReactNode; status?: ReactNode; action?: ReactNode;
  breadcrumbs?: readonly Crumb[]; breadcrumbLabel?: string; className?: string;
}) {
  return <header className={`ap-page-header ${className}`}>
    <div className="ap-page-header-copy">
      {breadcrumbs?.length && breadcrumbLabel ? <Breadcrumbs items={breadcrumbs} label={breadcrumbLabel} /> : null}
      {eyebrow && <div className="app-kicker-v2">{eyebrow}</div>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {(status || action) && <div className="ap-page-header-end">{status}{action}</div>}
  </header>;
}

/** Only render relation data that the caller already loaded and authorized. */
export function DocumentContext({ label, items }: { label: string; items: readonly { label: string; href?: string; detail?: string }[] }) {
  return <nav className="ap-document-context" aria-label={label}><ul>{items.map((item, index) => <li key={`${item.href ?? item.label}-${index}`}>
    {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
    {item.detail && <small>{item.detail}</small>}
  </li>)}</ul></nav>;
}
