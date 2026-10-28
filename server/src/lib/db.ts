import mongoose from 'mongoose';

export async function connectDb(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    // Indexes are created explicitly (npm run db:indexes), not on every boot.
    autoIndex: false,
  });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

/** Round-trips a ping so "connected" also means the server is answering. */
export async function pingDb(timeoutMs = 2000): Promise<boolean> {
  if (!isDbConnected() || !mongoose.connection.db) return false;
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
