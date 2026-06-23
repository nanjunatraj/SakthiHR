-- 20260621065531_whatsapp_cloud
-- WhatsApp Business Cloud API (Meta) integration. Establishment holds the non-secret
-- config (Phone Number ID / display number / WABA / webhook verify token); the access
-- token is a server-side Edge Function secret (WHATSAPP_TOKEN), never stored here.
-- whatsapp_notifications (message log) gains delivery-status fields fed by Meta webhooks.

alter table establishment add column if not exists wa_enabled boolean not null default false;
alter table establishment add column if not exists wa_phone_number_id text;
alter table establishment add column if not exists wa_display_number text;
alter table establishment add column if not exists wa_business_account_id text;
alter table establishment add column if not exists wa_webhook_verify_token text;

alter table whatsapp_notifications add column if not exists wamid text;          -- Meta message id
alter table whatsapp_notifications add column if not exists provider text not null default 'sim'; -- 'sim' | 'cloud'
alter table whatsapp_notifications add column if not exists status_at timestamptz;
alter table whatsapp_notifications add column if not exists error text;
create index if not exists idx_whatsapp_notifications_wamid on whatsapp_notifications(wamid);
create index if not exists idx_whatsapp_notifications_employee on whatsapp_notifications(employee_id, created_at desc);

do $$ begin
  alter publication supabase_realtime add table whatsapp_notifications;
exception when duplicate_object then null; end $$;
