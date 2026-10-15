"use client";

import { useEffect, useRef, type RefObject } from "react";

type Layer = { panel: HTMLElement; escape: () => void };
const layers: Layer[] = [];
const inertBefore = new Map<HTMLElement, boolean>();
let unlock: (() => void) | undefined;

function updateInert() {
  inertBefore.forEach((value, element) => { element.inert = value; });
  inertBefore.clear();
  let branch: HTMLElement | null = layers.at(-1)?.panel ?? null;
  while (branch && branch !== document.body) {
    for (const sibling of Array.from(branch.parentElement?.children ?? [])) {
      if (sibling !== branch && sibling instanceof HTMLElement && sibling.dataset.modalBackdrop !== layers.at(-1)?.panel.id && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) {
        inertBefore.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }
    branch = branch.parentElement;
  }
}

function lockDocument() {
  const x = window.scrollX, y = window.scrollY;
  const body = document.body;
  const documentStyle = document.documentElement.style;
  const gutter = window.innerWidth - document.documentElement.clientWidth;
  const previousDocumentOverflow = [documentStyle.getPropertyValue("overflow-y"), documentStyle.getPropertyPriority("overflow-y")];
  if (gutter > 0) documentStyle.setProperty("overflow-y", "scroll");
  const properties = ["position", "top", "left", "width", "overflow"] as const;
  const previous = properties.map(property => [property, body.style.getPropertyValue(property), body.style.getPropertyPriority(property)]);
  body.style.position = "fixed";
  body.style.top = `${-y}px`;
  body.style.left = `${-x}px`;
  body.style.width = "100%";
  body.style.overflow = "hidden";
  return () => {
    previous.forEach(([property, value, priority]) => value ? body.style.setProperty(property, value, priority) : body.style.removeProperty(property));
    if (gutter > 0) {
      if (previousDocumentOverflow[0]) documentStyle.setProperty("overflow-y", previousDocumentOverflow[0], previousDocumentOverflow[1]);
      else documentStyle.removeProperty("overflow-y");
    }
    window.scrollTo({ left: x, top: y, behavior: "instant" });
  };
}

// Shared stack: closing a nested surface cannot release the lower dialog's lock.
export function useModal({ active, panel, onClose, initialFocus, returnFocus }: {
  active: boolean;
  panel: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: () => HTMLElement | null;
}) {
  const callbacks = useRef({ onClose, returnFocus, initialFocus });
  callbacks.current = { onClose, returnFocus, initialFocus };
  useEffect(() => {
    const element = panel.current;
    if (!active || !element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer: Layer = { panel: element, escape: () => callbacks.current.onClose() };
    if (!layers.length) unlock = lockDocument();
    layers.push(layer);
    updateInert();
    const controls = () => Array.from(element.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(item => item.getClientRects().length && !item.closest("[inert]"));
    const focusFirst = () => (callbacks.current.initialFocus?.current ?? controls()[0] ?? element).focus({ preventScroll: true });
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== layer || event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); layer.escape(); }
      if (event.key !== "Tab") return;
      const items = controls(), first = items[0], last = items.at(-1);
      if (!items.length) { event.preventDefault(); element.focus(); }
      else if (!element.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const focusin = (event: FocusEvent) => { if (layers.at(-1) === layer && !element.contains(event.target as Node)) focusFirst(); };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    const observer = new MutationObserver(updateInert);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      layers.splice(layers.indexOf(layer), 1);
      updateInert();
      if (!layers.length) { unlock?.(); unlock = undefined; }
      const target = previous?.isConnected && previous.getClientRects().length && !previous.closest("[inert]") ? previous : callbacks.current.returnFocus?.();
      target?.focus({ preventScroll: true });
    };
  }, [active, panel]);
}
