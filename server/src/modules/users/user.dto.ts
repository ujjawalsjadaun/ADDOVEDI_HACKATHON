import type { UserAdmin } from '@golden-hour/shared';
import { maskPhone } from '../../lib/mask';
import { toAuthUser, toSafeUser } from '../auth/auth.dto';
import type { UserDocument } from './user.model';

export function toUserAdmin(doc: UserDocument, facilityName: string | null): UserAdmin {
  return {
    ...toSafeUser(toAuthUser(doc)),
    phoneMasked: maskPhone(doc.phone),
    villageLabel: doc.villageLabel ?? null,
    strikes: doc.strikes ?? 0,
    facilityName,
    lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toISOString() : null,
    createdAt: (doc.get('createdAt') as Date).toISOString(),
  };
}
