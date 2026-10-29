/**
 * The short code families use in an SMS request ("BLOOD O- Tawang-DH P1234"). Derived from the facility
 * name so no migration or admin step is needed: first word, then the initials of the rest.
 * "Siang Hills District Hospital" -> "Siang-HDH".
 */
export function hospitalSmsCode(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return '';
  const rest = words.slice(1).map((w) => w[0]!.toUpperCase()).join('');
  return rest ? `${words[0]}-${rest}` : words[0]!;
}
