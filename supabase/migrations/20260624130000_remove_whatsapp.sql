-- Remove the WhatsApp framework: drop the notifications log table and all
-- establishment WhatsApp (wa_*) configuration columns. Notifications that
-- previously went via WhatsApp (portal credentials, password resets, deduction
-- approval requests, celebration wishes) now route through email.

DROP TABLE IF EXISTS whatsapp_notifications;

ALTER TABLE establishment
  DROP COLUMN IF EXISTS wa_enabled,
  DROP COLUMN IF EXISTS wa_provider,
  DROP COLUMN IF EXISTS wa_phone_number_id,
  DROP COLUMN IF EXISTS wa_display_number,
  DROP COLUMN IF EXISTS wa_business_account_id,
  DROP COLUMN IF EXISTS wa_webhook_verify_token,
  DROP COLUMN IF EXISTS wa_web_service_url,
  DROP COLUMN IF EXISTS wa_web_api_key;
