/**
 * TEMPORARY. Ids for records the device creates.
 *
 * Real UUIDs arrive with the storage module (decision 28) -- what matters
 * before then is that every record has a *stable* id from the moment it is
 * created, because retrofitting ids onto records already on people's phones
 * is the painful version of this problem. This avoids pulling in a crypto
 * dependency to get that.
 *
 * Replace when `src/store` lands. One place, one edit.
 */
let counter = 0;

export const makeId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
