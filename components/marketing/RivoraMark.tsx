export function RivoraMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`nodra-wordmark ${className}`.trim()}
      aria-label="Averomira"
    >
      Averomira
    </span>
  );
}
