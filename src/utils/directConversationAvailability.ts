export interface ConversationAvailabilityChat {
  id: string;
  type: string;
}

export interface ConversationAvailabilityParticipant {
  chat_id: string;
  user_id: string;
}

interface ResolveUnavailableDirectChatsInput {
  userId: string;
  chats: readonly ConversationAvailabilityChat[];
  participants: readonly ConversationAvailabilityParticipant[];
  persistedBlockedUserIds: ReadonlySet<string>;
  locallyBlockedUserIds?: ReadonlySet<string>;
  isBlockedBetween: (otherUserId: string) => Promise<boolean>;
}

/**
 * Resolves direct-chat availability before any conversation rows are exposed
 * to the UI. Own persisted blocks are authoritative immediately; the
 * directionless server check covers the inverse relationship without telling
 * the client who initiated it. Group chats are deliberately outside this
 * decision because blocking one member must not remove the whole group.
 */
export async function resolveUnavailableDirectChatIds({
  userId,
  chats,
  participants,
  persistedBlockedUserIds,
  locallyBlockedUserIds = new Set<string>(),
  isBlockedBetween,
}: ResolveUnavailableDirectChatsInput): Promise<Set<string>> {
  const directChats = chats.filter((chat) => chat.type === 'direct');
  const counterpartsByChat = new Map<string, string>();
  const chatIdsByCounterpart = new Map<string, string[]>();
  const unavailable = new Set<string>();

  for (const chat of directChats) {
    const counterparts = participants
      .filter((participant) => participant.chat_id === chat.id && participant.user_id !== userId)
      .map((participant) => participant.user_id);

    // A usable direct conversation has exactly one counterpart. Fail closed
    // for malformed/orphaned rows rather than rendering an internal shell.
    if (counterparts.length !== 1) {
      unavailable.add(chat.id);
      continue;
    }

    const counterpart = counterparts[0];
    counterpartsByChat.set(chat.id, counterpart);
    const ids = chatIdsByCounterpart.get(counterpart) ?? [];
    ids.push(chat.id);
    chatIdsByCounterpart.set(counterpart, ids);

    if (persistedBlockedUserIds.has(counterpart) || locallyBlockedUserIds.has(counterpart)) {
      unavailable.add(chat.id);
    }
  }

  const unresolvedCounterparts = Array.from(chatIdsByCounterpart.keys()).filter(
    (counterpart) => !(persistedBlockedUserIds.has(counterpart) || locallyBlockedUserIds.has(counterpart)),
  );
  const blockedPairs = await Promise.all(
    unresolvedCounterparts.map(async (counterpart) => ({
      counterpart,
      blocked: await isBlockedBetween(counterpart),
    })),
  );

  for (const { counterpart, blocked } of blockedPairs) {
    if (!blocked) continue;
    for (const chatId of chatIdsByCounterpart.get(counterpart) ?? []) unavailable.add(chatId);
  }

  return unavailable;
}
