import type { BloodGroup } from './enums';

/**
 * Standard ABO/Rh red-cell compatibility: donor group → recipient groups it can give to.
 * Used only when the hospital ticks "accept compatible groups" on a request (decision D-08);
 * otherwise matching is exact-group only. Pending clinical review — not medical advice.
 */
const DONOR_CAN_GIVE_TO: Record<BloodGroup, readonly BloodGroup[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

/** Donor groups that may be alerted for a patient of `recipient`. */
export function eligibleDonorGroups(recipient: BloodGroup, acceptCompatible: boolean): BloodGroup[] {
  if (!acceptCompatible) return [recipient];
  return (Object.keys(DONOR_CAN_GIVE_TO) as BloodGroup[]).filter((donor) => DONOR_CAN_GIVE_TO[donor].includes(recipient));
}
