import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { CURRENCIES, CurrencyCode } from '@/domain/currency';
import { BillingCycle, CYCLE_PRESETS, describeCycle } from '@/domain/cycle';
import { formatDateLong, todayIso } from '@/domain/date';
import { formatMoney } from '@/domain/money';
import { BrandIcon } from '@/ui/BrandIcon';
import { Calendar } from '@/ui/Calendar';
import { Keypad } from '@/ui/Keypad';
import { toAccent, withAlpha } from '@/ui/color';
import { Pill, Txt } from '@/ui/primitives';
import { palette, radius, spacing } from '@/ui/theme';
import {
  changeCurrency,
  dateShortcuts,
  Draft,
  draftAmount,
  isDraftValid,
  popDigit,
  pushDigit,
  validateDraft,
} from './draft';

const CYCLE_OPTIONS: { label: string; cycle: BillingCycle }[] = [
  { label: 'Weekly', cycle: CYCLE_PRESETS.weekly },
  { label: 'Monthly', cycle: CYCLE_PRESETS.monthly },
  { label: 'Quarterly', cycle: CYCLE_PRESETS.quarterly },
  { label: 'Yearly', cycle: CYCLE_PRESETS.yearly },
];

function sameCycle(a: BillingCycle, b: BillingCycle): boolean {
  return a.unit === b.unit && a.interval === b.interval;
}

/**
 * The add/edit form.
 *
 * Ordered by how often each field actually needs touching: the amount is the
 * one thing a brand cannot prefill, so it gets the top of the screen and a
 * dedicated keypad. Cycle defaults to monthly and date to today, both of which
 * are right most of the time, so the common path is "type the number, save".
 *
 * Errors are only shown for fields that have been touched or after a failed
 * save attempt — flagging an empty amount the instant the screen opens is
 * nagging, not helping.
 */
export function SubscriptionFormScreen({
  draft,
  setDraft,
  onSave,
  onCancel,
  mode,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  mode: 'add' | 'edit';
}) {
  const [showCurrencies, setShowCurrencies] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const today = todayIso();
  const accent = useMemo(() => toAccent(draft.color), [draft.color]);
  const errors = validateDraft(draft, today);
  const amount = draftAmount(draft);
  const canSave = isDraftValid(draft, today);

  const patch = (changes: Partial<Draft>) => setDraft({ ...draft, ...changes });

  const handleSave = () => {
    setAttempted(true);
    if (!canSave) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Txt variant="label" color={palette.textMuted}>
            Cancel
          </Txt>
        </Pressable>
        <Txt variant="heading">{mode === 'add' ? 'New subscription' : 'Edit'}</Txt>
        <Pressable onPress={handleSave} hitSlop={12}>
          <Txt variant="label" color={canSave ? accent : palette.textFaint}>
            Save
          </Txt>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <BrandIcon brandId={draft.brandId} name={draft.name || '?'} size={52} />
          {draft.brandId ? (
            <Txt variant="title" numberOfLines={1} style={styles.identityName}>
              {draft.name}
            </Txt>
          ) : (
            <TextInput
              value={draft.name}
              onChangeText={(name) => patch({ name })}
              placeholder="What is it called?"
              placeholderTextColor={palette.textFaint}
              style={styles.nameInput}
              autoFocus={draft.name === ''}
            />
          )}
        </View>
        {attempted && errors.name && <FieldError message={errors.name} />}

        <View style={styles.amountBlock}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setShowCurrencies(true);
            }}
            style={styles.currencyChip}>
            <Txt variant="label" color={accent}>
              {draft.currency} ▾
            </Txt>
          </Pressable>
          <Txt
            variant="display"
            color={amount.amount === 0 ? palette.textFaint : palette.text}
            style={styles.amountText}>
            {formatMoney(amount)}
          </Txt>
          <Txt variant="label" color={palette.textFaint}>
            {describeCycle(draft.cycle).toLowerCase()}
          </Txt>
        </View>
        {attempted && errors.amount && <FieldError message={errors.amount} />}

        <Keypad
          onDigit={(key) => patch({ amountDigits: pushDigit(draft.amountDigits, key) })}
          onDelete={() => patch({ amountDigits: popDigit(draft.amountDigits) })}
        />

        <Field label="How often">
          <View style={styles.chips}>
            {CYCLE_OPTIONS.map((option) => {
              const active = sameCycle(draft.cycle, option.cycle);
              return (
                <Chip
                  key={option.label}
                  label={option.label}
                  active={active}
                  accent={accent}
                  onPress={() => patch({ cycle: option.cycle })}
                />
              );
            })}
          </View>
        </Field>

        <Field label={draft.isTrial ? 'Trial ends' : 'Next payment'}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setShowCalendar(true);
            }}
            style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
            <Txt variant="heading">{formatDateLong(draft.anchorDate, today)}</Txt>
            <Txt variant="label" color={palette.textFaint}>
              Change
            </Txt>
          </Pressable>
          <View style={styles.chips}>
            {dateShortcuts(today).map((shortcut) => (
              <Chip
                key={shortcut.label}
                label={shortcut.label}
                active={draft.anchorDate === shortcut.date}
                accent={accent}
                onPress={() => patch({ anchorDate: shortcut.date })}
              />
            ))}
          </View>
          {attempted && errors.anchorDate && <FieldError message={errors.anchorDate} />}
        </Field>

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Txt variant="heading">Free trial</Txt>
            <Txt variant="label" color={palette.textFaint}>
              Warn me before it starts charging
            </Txt>
          </View>
          <Switch
            value={draft.isTrial}
            onValueChange={(isTrial) => {
              Haptics.selectionAsync();
              // A trial that already ended is meaningless, so entering trial
              // mode with a past date moves it forward rather than erroring.
              patch({
                isTrial,
                anchorDate:
                  isTrial && draft.anchorDate < today ? today : draft.anchorDate,
              });
            }}
            trackColor={{ false: palette.border, true: withAlpha(accent, 0.5) }}
            thumbColor={draft.isTrial ? accent : palette.textFaint}
          />
        </View>

        <Field label="Notes">
          <TextInput
            value={draft.notes}
            onChangeText={(notes) => patch({ notes })}
            placeholder="Optional"
            placeholderTextColor={palette.textFaint}
            style={styles.textInput}
            multiline
          />
        </Field>
      </ScrollView>

      <CurrencySheet
        visible={showCurrencies}
        selected={draft.currency}
        accent={accent}
        onClose={() => setShowCurrencies(false)}
        onSelect={(currency) => {
          setDraft(changeCurrency(draft, currency));
          setShowCurrencies(false);
        }}
      />

      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowCalendar(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <Calendar
              value={draft.anchorDate}
              accent={accent}
              minDate={draft.isTrial ? today : undefined}
              onChange={(anchorDate) => {
                patch({ anchorDate });
                setShowCalendar(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function CurrencySheet({
  visible,
  selected,
  accent,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selected: CurrencyCode;
  accent: string;
  onClose: () => void;
  onSelect: (currency: CurrencyCode) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Txt variant="heading" style={styles.sheetTitle}>
            Currency
          </Txt>
          <ScrollView style={styles.currencyList}>
            {CURRENCIES.map((currency) => {
              const active = currency.code === selected;
              return (
                <Pressable
                  key={currency.code}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSelect(currency.code);
                  }}
                  style={({ pressed }) => [styles.currencyRow, pressed && styles.pressed]}>
                  <Txt variant="heading" color={active ? accent : palette.text}>
                    {currency.symbol}
                  </Txt>
                  <View style={styles.currencyText}>
                    <Txt variant="body" color={active ? accent : palette.text}>
                      {currency.code}
                    </Txt>
                    <Txt variant="label" color={palette.textFaint}>
                      {currency.name}
                    </Txt>
                  </View>
                  {active && <Txt variant="label" color={accent}>✓</Txt>}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Txt variant="caption" color={palette.textFaint}>
        {label.toUpperCase()}
      </Txt>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  accent,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: withAlpha(accent, 0.18), borderColor: accent },
        pressed && styles.pressed,
      ]}>
      <Txt variant="label" color={active ? accent : palette.textMuted}>
        {label}
      </Txt>
    </Pressable>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <View style={styles.errorRow}>
      <Pill tone="danger">{message}</Pill>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },

  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityName: { flex: 1 },
  nameInput: {
    flex: 1,
    color: palette.text,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },

  amountBlock: { alignItems: 'center', gap: spacing.xs },
  amountText: { fontSize: 46, letterSpacing: -1.5 },
  currencyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },

  field: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchText: { flex: 1, gap: 1 },

  textInput: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: palette.text,
    fontSize: 15,
    minHeight: 48,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  sheetTitle: { marginBottom: spacing.xs },
  currencyList: { maxHeight: 380 },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  currencyText: { flex: 1 },

  errorRow: { marginTop: -spacing.md },
  pressed: { opacity: 0.6 },
});
