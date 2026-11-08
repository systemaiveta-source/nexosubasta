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
- Keep auctions_safe as a security-barrier, owner-read projection with explicit draft filtering: invoker mode cannot read the deliberately revoked legacy starting_price; never repair that by granting raw price access.
- Auction social metadata is loaded anonymously from auctions_safe; share-image endpoints resolve only public item images and generate bounded JPEG renditions, never expose drafts, service attachments or signed storage URLs in head tags.
- Draft saves and publication limits use transactional RPCs; publication locks per owner to enforce membership limits under concurrency.
- Auction timing changes are versioned for new drafts; retain legacy published clocks, store inactivity in minutes, and return the trigger-computed deadline from the atomic bid RPC.
- Product rules_version >= 4 dispatches separate fixed/reserve/flash clock functions with per-auction phase state; earlier published versions retain their engine so simultaneous modes and legacy deadlines remain independent.
- Service close only opens client selection; a row-locked selection RPC creates one operation with client as buyer and provider as seller.
- Operations use authenticated server functions and transactional RPCs for messages, payment stages, disputes and independent confirmations; private attachments use storage RLS and expiring signed links.
- Auction payment declarations are separate from membership methods; each bid freezes accepted terms, and a deferred database constraint prevents bypassing acceptance.
- Operations list is an index route and detail is its sibling leaf; avoid a non-Outlet parent masking the private chat.
- Installation state lives in one root provider so prompt events survive navigation without touching authentication.
- Push permission and device synchronization live in one root lifecycle; passive sync never prompts, and read-notification deletion uses an owner-scoped transactional RPC including queue cleanup.
- Country and currency controls use a single searchable popover; public auction category and private service specialty stay separate to preserve catalog filters and private validation.
- Delivery snapshots are validated on drafts and frozen by deferred bid constraints; closed operations reject new messages at the database boundary.
- Service requests use a client-safe category schema and a private RLS table; exact locations never belong to the public auction projection, and unverified transport cannot publish.
- Native Web Push uses owner-scoped subscriptions, a messaging-only worker and WebCrypto encryption; dispatch is admin-authorized and bounded, endpoints are allowlisted, and delivery stays disabled until explicit runtime activation. Legacy FCM storage/worker remains untouched for compatibility, but current UI does not use Firebase.
- Public profiles expose only an explicit non-contact projection; own publication lists use an authenticated RPC based on auctions_safe to preserve drafts and server-only administrative flags.
- Membership advertising and badges derive from the effective subscription and structured plan entitlements in the database; advertising windows are anchored to subscription start, never client claims.
- Support requests are private owner/staff records; priority is derived server-side from the effective membership and responses require a staff-checked transactional RPC.
- Notification delivery retries only transient failures with bounded attempts and recovers stale claims; worker thumbnails accept only known origins and public auction image paths.
- Owner retirement of unsold zero-bid publications marks the historical auction instead of deleting it; this preserves auction evidence while excluding it from own publication lists.
- Profile activity shares the operations query across purchase/sale tabs, while secondary account queries load only when their disclosure opens to avoid redundant reads.
