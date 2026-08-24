import { openDB } from 'idb';

const DB_NAME = 'vocab-app-db';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cards')) {
        const store = db.createObjectStore('cards', { keyPath: 'id' });
        store.createIndex('word', 'word', { unique: false });
        store.createIndex('next_due', 'next_due');
      }
    },
  });
}

export async function getAllCards() {
  const db = await getDB();
  return db.getAll('cards');
}

export async function getDueCards() {
  const db = await getDB();
  const all = await db.getAll('cards');
  const now = new Date().toISOString();
  return all.filter(c => {
    if (!c.next_due) return true;
    if (c.repetition === 0) return true;
    return c.next_due <= now;
  });
}

export async function findCardByWord(word) {
  const db = await getDB();
  const target = word.trim().toLowerCase();
  const all = await db.getAll('cards');
  return all.find(c => c.word && c.word.toLowerCase() === target) || null;
}

export async function saveCard(card) {
  const db = await getDB();
  return db.put('cards', card);
}

export async function deleteCard(id) {
  const db = await getDB();
  return db.delete('cards', id);
}
