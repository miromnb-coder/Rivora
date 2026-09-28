-- Make the audit trail strictly append-only from the application role.
revoke all privileges on public.activity_events from authenticated;
grant select on public.activity_events to authenticated;
