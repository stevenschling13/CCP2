import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { GrowLog, PlantBatch, Room, AppError } from '../types';
import { MOCK_BATCHES, MOCK_ROOMS } from '../constants';

interface CultivatorDB extends DBSchema {
  batches: {
    key: string;
    value: PlantBatch;
  };
  logs: {
    key: string;
    value: GrowLog;
    indexes: { 'by-batch': string; 'by-date': number };
  };
  rooms: {
    key: string;
    value: Room;
  };
  errors: {
    key: string;
    value: AppError;
  };
}

const DB_NAME = 'cultivator-db';
const DB_VERSION = 1;

class DbService {
  private dbPromise: Promise<IDBPDatabase<CultivatorDB>>;

  constructor() {
    this.dbPromise = openDB<CultivatorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Batches store
        if (!db.objectStoreNames.contains('batches')) {
          db.createObjectStore('batches', { keyPath: 'id' });
        }
        // Logs store
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('by-batch', 'batchId');
          logStore.createIndex('by-date', 'timestamp');
        }
        // Rooms store
        if (!db.objectStoreNames.contains('rooms')) {
          db.createObjectStore('rooms', { keyPath: 'id' });
        }
        // Errors store
        if (!db.objectStoreNames.contains('errors')) {
          db.createObjectStore('errors', { keyPath: 'id' });
        }
      },
    });

    this.seedDefaults();
  }

  private async seedDefaults() {
    const db = await this.dbPromise;
    const batchCount = await db.count('batches');
    if (batchCount === 0) {
      console.log('Seeding default data...');
      const tx = db.transaction(['batches', 'rooms'], 'readwrite');
      await Promise.all([
        ...MOCK_BATCHES.map(b => tx.objectStore('batches').put(b)),
        ...MOCK_ROOMS.map(r => tx.objectStore('rooms').put(r))
      ]);
      await tx.done;
    }
  }

  async getBatches(): Promise<PlantBatch[]> {
    return (await this.dbPromise).getAll('batches');
  }

  async saveBatch(batch: PlantBatch): Promise<void> {
    await (await this.dbPromise).put('batches', batch);
  }

  async getRooms(): Promise<Room[]> {
    return (await this.dbPromise).getAll('rooms');
  }

  async saveRoom(room: Room): Promise<void> {
    await (await this.dbPromise).put('rooms', room);
  }

  async getLogs(batchId?: string): Promise<GrowLog[]> {
    const db = await this.dbPromise;
    if (batchId) {
      return db.getAllFromIndex('logs', 'by-batch', batchId);
    }
    return db.getAll('logs');
  }

  async saveLog(log: GrowLog): Promise<void> {
    await (await this.dbPromise).put('logs', log);
  }

  async logError(error: AppError): Promise<void> {
    await (await this.dbPromise).put('errors', error);
  }
}

export const dbService = new DbService();