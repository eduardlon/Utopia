-- Fix infinite recursion in conversation_participants RLS policy
-- The issue: RLS policy on conversation_participants references itself,
-- causing infinite recursion when querying the table.

-- Step 1: Drop the problematic policies
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can insert conversation participants" ON conversation_participants;

-- Step 2: Recreate with non-recursive policies using a security definer function
-- This function bypasses RLS to check membership without triggering recursion
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID, usr_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id AND user_id = usr_id
  );
$$;

-- Step 3: Create non-recursive RLS policies
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY "Users can insert conversation participants"
  ON conversation_participants
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
  );

-- Step 4: Ensure RLS is enabled
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
