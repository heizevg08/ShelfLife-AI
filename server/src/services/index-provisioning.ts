import type { Model } from 'mongoose';

export class IndexSetupFailure extends Error {
  constructor(readonly collection: string, readonly index: string | undefined, readonly source: unknown) {
    super('Index setup failed');
    this.name = 'IndexSetupFailure';
  }
}

type IndexKeys = Record<string, string | number>;

function generatedIndexName(keys: IndexKeys) {
  return Object.entries(keys).map(([field, direction]) => `${field}_${direction}`).join('_');
}

// Provision declared indexes one at a time so a failed startup diagnostic can name the exact safe collection/index pair.
export async function provisionModelIndexes<T extends Model<any>>(model: T) {
  for (const [keys, options] of model.schema.indexes()) {
    const index = typeof options.name === 'string' ? options.name : generatedIndexName(keys as IndexKeys);
    try {
      await model.collection.createIndex(keys as never, options as never);
    } catch (error) {
      throw new IndexSetupFailure(model.collection.name, index, error);
    }
  }
}

