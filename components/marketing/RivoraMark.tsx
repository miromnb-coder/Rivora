export function RivoraMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="relative h-7 w-7" aria-hidden="true">
        <span className="absolute left-1 top-1 h-2.5 w-5 -rotate-45 rounded-full bg-current" />
        <span className="absolute bottom-1 right-0 h-2.5 w-5 -rotate-45 rounded-full bg-current opacity-75" />
      </span>
      <span className="text-[19px] font-black tracking-[0.16em]">NODRA</span>
    </span>
  );
}
