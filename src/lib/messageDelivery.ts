export interface MessageWrite { id: string; conversation_id: string; sender_id: string; content: string; reply_to: string | null }
interface DeliveryError { message: string; code?: string }
interface WriteResult { error: DeliveryError | null }
interface LookupResult extends WriteResult { data: Pick<MessageWrite, 'content' | 'reply_to'> | null }

export async function acknowledgeMessage(
  message: MessageWrite,
  insert: (message: MessageWrite) => PromiseLike<WriteResult>,
  findOwnMessage: (id: string) => PromiseLike<LookupResult>,
): Promise<DeliveryError | null> {
  try {
    const result = await insert(message);
    if (result.error?.code !== '23505') return result.error;
    const existing = await findOwnMessage(message.id);
    if (!existing.error && existing.data?.content === message.content && existing.data.reply_to === message.reply_to) return null;
    return result.error;
  } catch { return { message: 'Message could not be acknowledged. Please retry.' }; }
}
