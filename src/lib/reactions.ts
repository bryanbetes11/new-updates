export interface EmojiReactionRecord {
  emoji: string;
  user_id: string;
}

export interface GroupedEmojiReaction {
  emoji: string;
  count: number;
  users: string[];
}

export function groupEmojiReactions(reactions: EmojiReactionRecord[]): GroupedEmojiReaction[] {
  const groups = new Map<string, GroupedEmojiReaction>();

  for (const reaction of reactions) {
    const existing = groups.get(reaction.emoji);
    if (existing) {
      existing.count += 1;
      existing.users.push(reaction.user_id);
    } else {
      groups.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        users: [reaction.user_id],
      });
    }
  }

  return Array.from(groups.values());
}
