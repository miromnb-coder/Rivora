# Conversation Experience 2.0 server persistence
The current existing JWT RLS client is used for own-user reads. New table writes use an **admin client inside authenticated Next.js route handlers only**, after the session, selected workspace and exact same-org owner have been rechecked. Direct authenticated browser INSERT/UPDATE/DELETE is revoked.

No Copilot business tables (RFQ, quote, Product Memory, ERP) are writable through CX2 APIs. IDs supplied by browser are only selectors. No AI text can be used as a source of authority. Conversation content is *untrusted historical context*.

Idempotency uses one unique row per (conversation_id, request_id, role). A reused request ID is rejected before an AI invocation and therefore cannot double-reserve by simple re-send. A pending assistant row is created before model work and finalized after successful AI settlement. Failed/cancelled messages never enter model conversation history.

Persistence requires three CX2 flags and the approved single-actor tenant gate. Failure of the new store does not silently opt in to cross-tenant reads.
