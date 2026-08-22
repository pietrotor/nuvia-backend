INSERT INTO "deposit_receipts" (
  "tenant_id",
  "conversation_id",
  "client_id",
  "appointment_id",
  "provider_message_id",
  "storage_key",
  "mime_type",
  "received_at",
  "status",
  "source",
  "classification"
)
SELECT
  appointment."tenant_id",
  (
    SELECT conversation."id"
    FROM "conversations" conversation
    WHERE conversation."tenant_id" = appointment."tenant_id"
      AND conversation."client_id" = appointment."booking_contact_client_id"
    ORDER BY conversation."last_activity_at" DESC
    LIMIT 1
  ),
  appointment."booking_contact_client_id",
  appointment."id",
  appointment."deposit_receipt_provider_message_id",
  appointment."deposit_receipt_storage_key",
  appointment."deposit_receipt_mime_type",
  appointment."deposit_receipt_received_at",
  'assigned',
  CASE
    WHEN appointment."deposit_receipt_provider_message_id" IS NULL THEN 'staff'
    ELSE 'whatsapp'
  END::"deposit_receipt_source",
  CASE
    WHEN appointment."deposit_receipt_provider_message_id" IS NULL THEN 'staff_upload'
    ELSE 'unknown'
  END::"deposit_receipt_classification"
FROM "appointments" appointment
WHERE appointment."deposit_receipt_storage_key" IS NOT NULL
  AND appointment."deposit_receipt_mime_type" IS NOT NULL
  AND appointment."deposit_receipt_received_at" IS NOT NULL
ON CONFLICT ("tenant_id", "provider_message_id")
  WHERE "provider_message_id" IS NOT NULL
  DO NOTHING;