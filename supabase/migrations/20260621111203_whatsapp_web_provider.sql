-- 20260621111203_whatsapp_web_provider
-- Adds the "WhatsApp Web (QR session link)" provider alongside the Cloud API.
-- wa_provider selects which gateway the app uses; the WhatsApp Web companion
-- service (whatsapp-web.js, self-hosted) is reached at wa_web_service_url with
-- wa_web_api_key. (whatsapp_notifications.provider already records 'web' sends.)

alter table establishment add column if not exists wa_provider text not null default 'cloud'; -- 'cloud' | 'web' | 'off'
alter table establishment add column if not exists wa_web_service_url text;
alter table establishment add column if not exists wa_web_api_key text;
