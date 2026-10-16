# Phase 2 — Premium Workspace Shell

The development branch now includes an **opt-in Minimal Linen workspace shell** for
all authenticated routes. Production is unchanged until PR review/merge.

## Layout
- Desktop >=1360px: white navigation 232px, center min 700px at breakpoint,
  Linen-canvas Copilot area 360px (400px at >=1600px), with 16px outer padding
  and gaps. Sidebar can be collapsed to 72px; Copilot can be dismissed/reopened.
- 1024–1359px: sidebar plus full-width center. Copilot opens in a modal drawer.
- 768–1023px: compact 72px rail, user-expandable to 232px; full-width work area,
  Copilot drawer.
- <768px: mobile header/account dropdown, bottom navigation, full-screen Copilot
  drawer with safe-area padding.
- The Copilot section is a visual placeholder: **no AI backend, no text composer,
  no database writes** in Phase 2.

## Preservation
- The existing AppNav active-route logic, AppLocation breadcrumbs, signOut,
  locale switcher, authorization-protected ProductLayout, leads gate and
  SupportCenter component remain.
- No pages' server-side queries or business processes were modified.
- Existing RFQ/PO/ERP components remain unchanged; interior page refinements
  are part of Phase 3.
- CSS is gated behind .app-shell-v2.ml-workspace-shell and imported only by
  the protected app layout. Public marketing/auth remain unchanged.

## Testing and deployment
Run the existing CI checks (`npm run typecheck`, `npm test`, `npm run build`)
plus UI inspection at 320, 390, 768, 1024, 1360, 1440 and 1920px widths.
The draft PR must **not** be merged without visual/browser review.
Preview environments might still have production Supabase credentials; avoid
editing real customer records until database isolation is verified.
