# WhatsApp Business Cloud API — setup

This Edge Function is the WhatsApp gateway for SakthiHR. It (a) sends messages via Meta's
Graph API and (b) receives Meta delivery-status webhooks, writing both into
`whatsapp_notifications`. The app never sees the access token — it lives only here as a secret.

## One-time setup (done by you)

1. **Create a Meta app + WhatsApp Business**
   - Go to <https://developers.facebook.com/> → create an app → add the **WhatsApp** product.
   - In *WhatsApp → API Setup*, note the **Phone Number ID** and your **WhatsApp Business Account ID (WABA)**.
   - Generate a **permanent access token** (System User token) — this is the secret.

2. **Set the access token as a Supabase secret** (never put it in the app/DB):
   ```bash
   supabase secrets set WHATSAPP_TOKEN="<your-meta-access-token>" --project-ref cngmweuxrrhvneiryajn
   ```
   (or Supabase Dashboard → Edge Functions → Manage secrets → add `WHATSAPP_TOKEN`).

3. **Fill the config in the app**: Establishment Master → *WhatsApp Business (Cloud API)*:
   - Phone Number ID, Display/Business Number, (optional) WABA ID,
   - a **Webhook Verify Token** (any string you choose),
   - toggle **Enable**.

4. **Register the webhook in Meta** (*WhatsApp → Configuration → Webhooks*):
   - Callback URL: `https://cngmweuxrrhvneiryajn.supabase.co/functions/v1/whatsapp`
   - Verify Token: the same string you entered in step 3.
   - Subscribe to the **`messages`** field (carries delivery statuses).

5. **Test**: Establishment Master → *Send Test* (a number you've messaged from in test mode,
   or any number once your number is live). Watch the status flip Sent → Delivered → Read via
   the Employee Master **Check** button.

## Notes
- Deployed with `--no-verify-jwt` so Meta's (unauthenticated) webhook can reach it. The access
  token stays server-side; the function reads the rest of the config from the `establishment` row.
- Until `WHATSAPP_TOKEN` is set and the number is live, sends return a clean `Failed` with a reason
  (e.g. *"Server secret WHATSAPP_TOKEN is not set."*) — nothing crashes.
- The 24-hour customer-service window and message-template rules are Meta's; free-form text only
  works inside an open conversation window or in test mode. For proactive messages you'll typically
  use approved **message templates** (a future enhancement to this function).
