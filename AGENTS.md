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
