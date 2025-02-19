import EventEmitter2 from 'eventemitter2';

import type { ConnectionStatus } from '../connection';
import type { BlobStorage } from './blob';
import type { DocStorage } from './doc';
import type { Storage, StorageType } from './storage';
import type { SyncStorage } from './sync';

type Storages = DocStorage | BlobStorage | SyncStorage;

export class SpaceStorage {
  protected readonly storages: Map<StorageType, Storage> = new Map();
  private readonly event = new EventEmitter2();
  private readonly disposables: Set<() => void> = new Set();

  constructor(storages: Storage[] = []) {
    this.storages = new Map(
      storages.map(storage => [storage.storageType, storage])
    );
  }

  tryGet<T extends StorageType>(
    type: T
  ): Extract<Storages, { storageType: T }> | undefined {
    return this.storages.get(type) as unknown as Extract<
      Storages,
      { storageType: T }
    >;
  }

  get<T extends StorageType>(type: T): Extract<Storages, { storageType: T }> {
    const storage = this.tryGet(type);

    if (!storage) {
      throw new Error(`Storage ${type} not registered.`);
    }

    return storage as Extract<Storages, { storageType: T }>;
  }

  async connect() {
    await Promise.allSettled(
      Array.from(this.storages.values()).map(async storage => {
        // FIXME: multiple calls will register multiple listeners
        this.disposables.add(
          storage.connection.onStatusChanged((status, error) => {
            this.event.emit('connection', {
              storage: storage.storageType,
              status,
              error,
            });
          })
        );
        await storage.connect();
      })
    );
  }

  async disconnect() {
    await Promise.allSettled(
      Array.from(this.storages.values()).map(async storage => {
        await storage.disconnect();
      })
    );
  }

  on(
    event: 'connection',
    cb: (payload: {
      storage: StorageType;
      status: ConnectionStatus;
      error?: Error;
    }) => void
  ): () => void {
    this.event.on(event, cb);
    return () => {
      this.event.off(event, cb);
    };
  }

  off(
    event: 'connection',
    cb: (payload: {
      storage: StorageType;
      status: ConnectionStatus;
      error?: Error;
    }) => void
  ): void {
    this.event.off(event, cb);
  }

  async destroy() {
    await this.disconnect();
    this.disposables.forEach(disposable => disposable());
    this.event.removeAllListeners();
    this.storages.clear();
  }
}

export * from './blob';
export * from './doc';
export * from './history';
export * from './storage';
export * from './sync';
