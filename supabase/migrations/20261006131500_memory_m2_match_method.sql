-- M2 follow-up: allow the canonical Smart Product Memory method on RFQ
-- candidates and selected RFQ lines.

alter table public.product_match_candidates
  drop constraint if exists product_match_candidates_method_check;

alter table public.product_match_candidates
  add constraint product_match_candidates_method_check
  check (
    method in (
      'product_memory',
      'customer_memory',
      'exact_sku',
      'exact_mpn',
      'fuzzy'
    )
  );

alter table public.rfq_lines
  drop constraint if exists rfq_lines_match_method_check;

alter table public.rfq_lines
  add constraint rfq_lines_match_method_check
  check (
    match_method is null
    or match_method in (
      'product_memory',
      'customer_memory',
      'exact_sku',
      'exact_mpn',
      'fuzzy',
      'manual'
    )
  );
