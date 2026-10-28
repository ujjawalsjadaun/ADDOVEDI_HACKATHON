import { existsSync } from 'node:fs';
import { createInterface, type Interface } from 'node:readline';
import { loadConfig, ConfigError, type Config } from '../config/env';
import { connectDb, disconnectDb } from '../lib/db';

/** Shared bootstrap for operator commands: load server/.env, validate, connect. */
export async function bootstrap(): Promise<Config> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  let config: Config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
  await connectDb(config.MONGODB_URI);
  return config;
}

// One interface for the whole command, read through its async iterator, which buffers lines.
// A fresh interface (or rl.question) per prompt loses lines that arrive together (pasted or piped input).
let rl: Interface | undefined;
let lines: AsyncIterator<string> | undefined;
let muted = false;

export class InputEndedError extends Error {
  constructor() {
    super('Input ended before all questions were answered.');
  }
}

function reader(): AsyncIterator<string> {
  if (!lines) {
    rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    const write = out._writeToOutput.bind(rl);
    // While muted, echo nothing (hidden password entry).
    out._writeToOutput = (s: string) => {
      if (!muted) write(s);
    };
    lines = rl[Symbol.asyncIterator]();
  }
  return lines;
}

export async function ask(question: string, { hidden = false } = {}): Promise<string> {
  const it = reader();
  process.stdout.write(question);
  muted = hidden;
  try {
    const next = await it.next();
    if (next.done) throw new InputEndedError();
    return next.value.trim();
  } finally {
    muted = false;
    if (hidden) process.stdout.write('\n');
  }
}

export async function shutdown(code = 0): Promise<never> {
  rl?.close();
  await disconnectDb().catch(() => undefined);
  process.exit(code);
}
