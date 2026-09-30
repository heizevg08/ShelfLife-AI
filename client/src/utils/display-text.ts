export function formatHumanReadableText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/(^|[\s/(-])([\p{L}\p{N}])/gu, (_, prefix: string, character: string) => `${prefix}${character.toLocaleUpperCase()}`);
}
