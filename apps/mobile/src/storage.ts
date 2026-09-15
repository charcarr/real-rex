import { createMMKV } from 'react-native-mmkv';

import { readDocument, writeDocument, type StoredDocument } from './document.ts';

/**
 * The device's storage, and the only file in the app that knows what it is
 * (decision 28). Everything else goes through the store.
 *
 * MMKV rather than AsyncStorage for one reason: `getString` RETURNS a value,
 * it does not resolve one. The library is therefore in hand before the first
 * component renders -- home has nothing to wait for, and there is no empty
 * state to hide behind the splash. Everything else about MMKV is a bonus.
 *
 * MMKV v4 is built on Nitro, so `react-native-nitro-modules` is a second
 * native dependency. Both are declared in this app's own package.json:
 * autolinking reads the app's dependencies, and a hoisted native module links
 * to nothing and fails at runtime with no build error.
 */
const mmkv = createMMKV({
  id: 'realrex',
  // Until someone publishes, this file is the only copy of their library
  // (decision 28), so a CRC or file-length error should be repaired rather
  // than discarded. The default is to discard.
  recoveryStrategy: 'recover-on-error',
});

export const loadDocument = (): StoredDocument => readDocument(mmkv);

export const saveDocument = (document: StoredDocument): void => writeDocument(mmkv, document);

/**
 * The three methods `supabase-js` asks of a storage engine (decision 47).
 *
 * It awaits whatever these return, so a synchronous store satisfies it
 * unchanged -- which is why the session shares the document's MMKV instead of
 * bringing AsyncStorage and a second native dependency along for one token.
 *
 * MMKV v4 spells removal `remove`, not `delete`.
 */
export const sessionStorage = {
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    mmkv.set(key, value);
  },
  removeItem: (key: string): void => {
    mmkv.remove(key);
  },
};
