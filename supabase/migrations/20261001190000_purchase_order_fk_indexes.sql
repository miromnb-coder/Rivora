-- Cover purchase-order foreign keys used by deletes, joins and workspace filtering.

create index if not exists purchase_orders_customer_id_idx
  on public.purchase_orders(customer_id);

create index if not exists purchase_orders_quote_id_idx
  on public.purchase_orders(quote_id)
  where quote_id is not null;

create index if not exists purchase_orders_created_by_idx
  on public.purchase_orders(created_by)
  where created_by is not null;

create index if not exists purchase_order_lines_organization_id_idx
  on public.purchase_order_lines(organization_id);

create index if not exists purchase_order_files_organization_id_idx
  on public.purchase_order_files(organization_id);
