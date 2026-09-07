import { Mongoose } from 'mongoose';

export interface Database {
  connect(uri: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

// An isolated Mongoose instance, without models, seeds, or import-time I/O.
export function createDatabase(driver = new Mongoose()): Database {
  return {
    async connect(uri) {
      await driver.connect(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, autoIndex: false, autoCreate: false });
    },
    async disconnect() { await driver.disconnect(); },
    isConnected() { return driver.connection.readyState === 1; },
  };
}
