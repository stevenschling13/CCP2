import { openDB } from 'idb';
import type { ChatMessage } from '../types';

const DB_NAME = 'cc-chat';
const STORE_NAME = 'messages';
const HISTORY_KEY = 'history';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  },
});

export async function loadMessages(): Promise<ChatMessage[]> {
  const db = await dbPromise;
  const messages = await db.get(STORE_NAME, HISTORY_KEY);
  return Array.isArray(messages) ? messages : [];
}

export async function saveMessages(msgs: ChatMessage[]): Promise<void> {
  const db = await dbPromise;
  await db.put(STORE_NAME, msgs, HISTORY_KEY);
}

export async function clearMessages(): Promise<void> {
  const db = await dbPromise;
  await db.delete(STORE_NAME, HISTORY_KEY);
}
