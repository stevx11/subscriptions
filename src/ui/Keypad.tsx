import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { palette, radius, spacing } from './theme';

/**
 * A purpose-built numeric pad.
 *
 * The system keyboard is wrong for this: its number row is small, the decimal
 * separator moves depending on locale, and it covers half the screen with keys
 * that cannot be pressed here. Digits fill the minor units from the right, so
 * there is no decimal key at all — typing 1-3-9-9 gives 13.99, and there is no
 * cursor to place or malformed input to reject.
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

interface KeypadProps {
  onDigit: (key: string) => void;
  onDelete: () => void;
}

function KeypadComponent({ onDigit, onDelete }: KeypadProps) {
  return (
    <View style={styles.pad}>
      {KEYS.map((key) => (
        <Key
          key={key}
          label={key}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (key === 'del') {
              onDelete();
            } else {
              onDigit(key);
            }
          }}
        />
      ))}
    </View>
  );
}

function Key({ label, onPress }: { label: string; onPress: () => void }) {
  const isDelete = label === 'del';
  return (
    <Pressable
      onPress={onPress}
      // A long-press on delete would ideally clear; kept simple until asked.
      accessibilityLabel={isDelete ? 'Delete last digit' : `Digit ${label}`}
      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
      <Text style={[styles.keyLabel, isDelete && styles.deleteLabel]}>
        {isDelete ? '⌫' : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  key: {
    // Three per row, accounting for the two gaps between them.
    width: `${(100 - 6) / 3}%`,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: palette.surfaceRaised, transform: [{ scale: 0.97 }] },
  keyLabel: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  deleteLabel: { color: palette.textMuted, fontSize: 20 },
});

export const Keypad = memo(KeypadComponent);
