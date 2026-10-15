import type { AnchorHTMLAttributes } from "react";
import { useRouter } from "./navigation";
export default function Link({ href = "", prefetch: _prefetch, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  const router = useRouter();
  return <a {...props} href={href} onClick={event => { onClick?.(event); if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey) { event.preventDefault(); router.push(href); } }} />;
}
