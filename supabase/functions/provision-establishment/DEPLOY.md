# SaaS provisioning — deploy & operate

The `provision-establishment` and `manage-establishment` Edge Functions create and
manage one isolated Supabase **project per establishment**. They run on the
**control-plane** project (`jmwbkdlucbcxpbdntzen`).

## Prerequisites (one-time)

1. **Supabase Pro** on the org (free plan caps at 2 projects).
2. **Edge Function secrets** (Dashboard → Project → Edge Functions → Secrets, or
   `supabase secrets set`):
   - `SUPABASE_ACCESS_TOKEN` — Management API token (Account → Access Tokens).
   - `SUPABASE_ORG_ID` — `rgmvmifmtsyizcisebpy`.
   - `SUPABASE_PROJECT_REGION` — optional, default `ap-south-1`.
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)
3. **Schema artifacts in Storage** — create a private bucket `platform-artifacts`
   on the control-plane project and upload:
   - `supabase/tenant/tenant_template.sql` → `tenant_template.sql`
   - (optional) a `tenant_seed.sql` of default masters → `tenant_seed.sql`
   The provisioning function downloads these (service role) and applies them to
   each new tenant project.
4. Apply migration `20260630150000_saas_vault_tenant_key_helpers.sql` (Vault RPCs)
   — already applied to the control plane.

## Flow

`provision-establishment { code, name }` → create project → poll healthy → apply
template (+ seed) → create ADMIN (`ADMIN`/`PASSWORD`, must change) → store service
key in Vault → mark registry `Active`.

`manage-establishment { action, code }` → `compact` (VACUUM ANALYZE) /
`suspend` / `restore` / `admin_session` (returns a tenant ADMIN session for the
desktop "Access as Admin").

## Deploy

```
supabase functions deploy provision-establishment --project-ref jmwbkdlucbcxpbdntzen
supabase functions deploy manage-establishment   --project-ref jmwbkdlucbcxpbdntzen
```

## Not yet validated end-to-end

These functions are written but **not deployed/run** — that needs the Management
API token + Pro. The tenant template, registry, runtime tenant switching, the
console, and code-based login + isolation are all verified (the latter via the
manually-provisioned TESTCO tenant).
