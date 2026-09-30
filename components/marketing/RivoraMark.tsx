export function RivoraMark({ className = "" }: { className?: string }) {
  return (
    <span className={`nodra-logo-lockup ${className}`.trim()}>
      <img
        src="/brand/nodra-primary-black.svg"
        alt="Nodra"
        className="nodra-logo-lockup-image"
      />
    </span>
  );
}
