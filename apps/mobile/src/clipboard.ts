import * as Clipboard from 'expo-clipboard';

/**
 * The twenty characters that know about the clipboard.
 *
 * React Native core dropped `Clipboard`, so copying needs a native module
 * (decision 37 deferred it; 45 puts it in). It lives behind one function for
 * the same reason `storage.ts` exists: if the module ever has to change, this
 * is the only file that knows.
 */
export const copyToClipboard = (text: string): Promise<void> =>
  Clipboard.setStringAsync(text).then(() => undefined);
