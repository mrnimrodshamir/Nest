export type ActiveChatIdentity =
  | { type: 'group'; activityId: string }
  | { type: 'direct'; otherUserId: string }
  | null;

let activeChat: ActiveChatIdentity = null;

export function setActiveChat(identity: ActiveChatIdentity): void {
  activeChat = identity;
}

export function getActiveChat(): ActiveChatIdentity {
  return activeChat;
}

/** True if a push notification's data payload refers to the chat currently
 *  open on screen — used to suppress the foreground banner (the open
 *  ChatScreen already gets the message via its realtime subscription, so a
 *  banner on top would just be a duplicate). */
export function isNotificationForActiveChat(data: Record<string, unknown> | undefined): boolean {
  if (!activeChat || !data) return false;
  if (activeChat.type === 'group') {
    return data.kind === 'chat' && data.activityId === activeChat.activityId;
  }
  return data.kind === 'direct_message' && data.otherUserId === activeChat.otherUserId;
}
