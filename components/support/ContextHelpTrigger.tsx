"use client";

export const SUPPORT_OPEN_EVENT = "averomira:support-open";

export function ContextHelpTrigger({
  articleId,
  label,
  className = "",
}: {
  articleId: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`context-help-trigger ${className}`.trim()}
      aria-label={label}
      title={label}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent(SUPPORT_OPEN_EVENT, {
            detail: { articleId },
          }),
        );
      }}
    >
      <span aria-hidden="true">?</span>
    </button>
  );
}
