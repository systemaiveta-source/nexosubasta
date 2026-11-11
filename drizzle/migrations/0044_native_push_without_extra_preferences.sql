-- Remove application-level notification checkboxes as a second consent layer.
-- Browser permission remains the sole opt-in; registerPushDevice links the granted device.
UPDATE public.notification_preferences
SET new_auctions = true,
    activity = true,
    categories = ARRAY[]::uuid[],
    push_consent_initialized = true,
    updated_at = now();

COMMENT ON COLUMN public.notification_preferences.categories IS
  'Retained for backwards compatibility; native Web Push is not gated by user-selected categories.';
