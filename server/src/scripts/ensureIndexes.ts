// npm run db:indexes -w server
// Creates all declared indexes. Additive only — never drops an index.

import { ensureIndexes } from '../lib/indexes';
import { bootstrap, shutdown } from './cli';

await bootstrap();
const models = await ensureIndexes();
console.log(`Indexes ensured for: ${models.join(', ')}`);
await shutdown(0);
