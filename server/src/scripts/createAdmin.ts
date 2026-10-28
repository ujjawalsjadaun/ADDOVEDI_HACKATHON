// npm run create-admin -w server
// Creates the first administrator interactively. There is no public admin sign-up (docs/security.md §1).

import { createUserSchema } from '@golden-hour/shared';
import { AppError } from '../lib/errors';
import { ensureIndexes } from '../lib/indexes';
import { SYSTEM_ACTOR } from '../modules/audit/audit.service';
import { createUser } from '../modules/users/user.service';
import { ask, bootstrap, InputEndedError, shutdown } from './cli';

async function main(): Promise<number> {
  await bootstrap();
  await ensureIndexes();

  const name = await ask('Admin name: ');
  const email = await ask('Admin email: ');
  const password = await ask('Password (min 10 characters, hidden): ', { hidden: true });
  const confirm = await ask('Repeat password: ', { hidden: true });

  if (password !== confirm) {
    console.error('Passwords do not match. Nothing was created.');
    return 1;
  }

  const parsed = createUserSchema.safeParse({ name, email, password, role: 'admin' });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    console.error('Nothing was created.');
    return 1;
  }

  const admin = await createUser(parsed.data, SYSTEM_ACTOR);
  console.log(`Created admin ${admin.email}. Sign in at the web app's /login page.`);
  return 0;
}

try {
  await shutdown(await main());
} catch (err) {
  if (err instanceof AppError || err instanceof InputEndedError) {
    console.error(`${err.message} Nothing was created.`);
  } else {
    console.error(err);
  }
  await shutdown(1);
}
