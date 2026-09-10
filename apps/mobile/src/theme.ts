import { useColorScheme } from 'react-native';

import { dark, light, type ColorScheme } from '@real-rex/shared';

/**
 * The active palette. Components read semantic roles from here and never
 * import `light` or `dark` directly — that is what makes dark mode a swap
 * rather than a refactor (see the note at the top of tokens.ts).
 *
 * `userInterfaceStyle` is "automatic" in app.json, so this follows the system.
 */
export function useTheme(): ColorScheme {
  return useColorScheme() === 'dark' ? dark : light;
}
