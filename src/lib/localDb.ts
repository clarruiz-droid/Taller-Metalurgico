import { openDB } from 'idb';

const DB_NAME = 'TallerMetalurgicoDB';
const STORE_NAME = 'temp_images';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const saveLocalImage = async (key: string, blob: Blob) => {
  const db = await initDB();
  await db.put(STORE_NAME, blob, key);
};

export const getLocalImage = async (key: string): Promise<Blob | null> => {
  const db = await initDB();
  return db.get(STORE_NAME, key);
};

export const deleteLocalImage = async (key: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, key);
};
