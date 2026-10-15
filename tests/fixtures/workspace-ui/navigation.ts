import { useSyncExternalStore } from "react";
export function notFound(): never { throw new Error("Missing synthetic Workspace record"); }
const subscribe = (callback: () => void) => { window.addEventListener("popstate", callback); window.addEventListener("hashchange", callback); return () => { window.removeEventListener("popstate", callback); window.removeEventListener("hashchange", callback); }; };
const snapshot = () => location.pathname + location.search + location.hash;
export function usePathname() { useSyncExternalStore(subscribe, snapshot, () => "/app"); return location.pathname; }
export function useSearchParams() { useSyncExternalStore(subscribe, snapshot, () => "/app"); return new URLSearchParams(location.search); }
export function useRouter() { return { push(href: string) { history.pushState({}, "", href); window.dispatchEvent(new PopStateEvent("popstate")); }, refresh() {} }; }
