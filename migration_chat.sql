-- Run this migration if the conversations/messages tables already exist
-- but are missing the new columns.

-- Add updated_at to conversations (if missing)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Add unique constraint on conversations (if missing)
-- This prevents duplicate conversations between two users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_user1_id_user2_id_key'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_user1_id_user2_id_key UNIQUE (user1_id, user2_id);
  END IF;
END $$;

-- Add is_read to messages (if missing)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Add indexes (if missing)
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
