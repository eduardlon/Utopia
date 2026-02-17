-- Enable users to create conversations (required for new chats)
CREATE POLICY "Users can create conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Enable users to add participants to conversations (required to add themselves and recipient)
CREATE POLICY "Users can insert participants" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
