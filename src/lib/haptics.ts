/**
 * Thin wrapper around react-native Vibration for haptic feedback.
 * Android only — iOS would need react-native-haptic-feedback, but this
 * app targets Android telecallers so Vibration is sufficient and has
 * zero extra dependencies.
 *
 * Usage:
 *   import { haptics } from '../lib/haptics';
 *   haptics.light();   // subtle tap (button press)
 *   haptics.medium();  // confirmation (sync complete, filter applied)
 *   haptics.success(); // double-tap (target hit, streak)
 *   haptics.error();   // error pattern
 */

import { Vibration } from 'react-native';

export const haptics = {
  /** Subtle tap — use for any interactive element press */
  light() {
    Vibration.vibrate(10);
  },

  /** Confirmation — use for filter apply, sync complete */
  medium() {
    Vibration.vibrate(20);
  },

  /** Success double-tap — use for target hit, streak milestone */
  success() {
    Vibration.vibrate([0, 15, 60, 15]);
  },

  /** Error pattern — use for sync failure, permission denied */
  error() {
    Vibration.vibrate([0, 30, 50, 30]);
  },
};
