import mongoose from 'mongoose';
import '../modules/models';

/**
 * Creates every index declared in the schemas. Idempotent and additive: it never drops an index,
 * so a changed index definition needs a manual, reviewed migration (docs/data-model.md).
 */
export async function ensureIndexes(): Promise<string[]> {
  const names = mongoose.modelNames();
  for (const name of names) {
    await mongoose.model(name).createIndexes();
  }
  return names;
}
