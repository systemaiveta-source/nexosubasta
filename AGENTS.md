<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Manual membership submissions and review transitions use transactional database RPCs; direct request writes are revoked to prevent bypassing validation and single approval.
- Membership documents use a private bucket and authenticated, signature-checked server uploads; temporary signed links are generated only under storage RLS.
- Payment method configuration and proof requirements share a client-safe schema; each request freezes method and plan snapshots to preserve payment instructions and purchased duration.
- PL/pgSQL validation routines must use distinct variable names and explicitly qualified set-returning-function column aliases to prevent variable/column ambiguity without weakening validation.
- Authentication returns and notification links share a known-route destination validator; notification reads and read-state writes use authenticated server functions scoped to the caller, with polling as a reliable update fallback.
- Public auction screens read auctions_safe, never legacy starting_price directly; the projection suppresses service budgets and explicitly scopes draft visibility.
- Draft saves and publication limits use transactional RPCs; publication locks per owner to enforce membership limits under concurrency.
- Service close only opens client selection; a row-locked selection RPC creates one operation with client as buyer and provider as seller.
- Operations use authenticated server functions and transactional RPCs for messages, payment stages, disputes and independent confirmations; private attachments use storage RLS and expiring signed links.
- Auction payment declarations are separate from membership methods; each bid freezes accepted terms, and a deferred database constraint prevents bypassing acceptance.
- Operations list is an index route and detail is its sibling leaf; avoid a non-Outlet parent masking the private chat.
- Installation state lives in one root provider so prompt events survive navigation without touching authentication.
- Delivery snapshots are validated on drafts and frozen by deferred bid constraints; closed operations reject new messages at the database boundary.
- Service requests use a client-safe category schema and a private RLS table; exact locations never belong to the public auction projection, and unverified transport cannot publish.
- Push uses an opt-in transactional outbox and messaging-only worker; dispatch is admin-authorized, bounded and disabled until explicit runtime activation, with no automatic sends during development.
