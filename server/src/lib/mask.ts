/** +919000012345 → +91******2345 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 7) return '*'.repeat(phone.length);
  return `${phone.slice(0, 3)}${'*'.repeat(phone.length - 7)}${phone.slice(-4)}`;
}
