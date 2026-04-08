import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import {
  collection,
  addDoc,
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { EventType } from '../types';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useTeam } from '../contexts/TeamContext';

type Props = {
  navigation: any;
};

type RepeatMode = 'none' | 'weekly' | 'biweekly';

const MAX_OCCURRENCES = 52;

function generateOccurrences(startDate: Date, repeatMode: RepeatMode, untilDate: Date): Date[] {
  if (repeatMode === 'none') return [startDate];
  const intervalMs = repeatMode === 'weekly' ? 7 * 86400000 : 14 * 86400000;
  const dates: Date[] = [startDate];
  let current = startDate.getTime();
  const untilMs = untilDate.getTime();

  while (dates.length < MAX_OCCURRENCES) {
    current += intervalMs;
    if (current > untilMs) break;
    dates.push(new Date(current));
  }
  return dates;
}

export default function CreateEventScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [type, setType] = useState<EventType>('training');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [opponent, setOpponent] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventTime, setEventTime] = useState(new Date(2026, 0, 1, 20, 0));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date(2026, 0, 1, 20, 0));

  // Repeat
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [untilDate, setUntilDate] = useState<Date | null>(null);
  const [showUntilPicker, setShowUntilPicker] = useState(false);
  const [tempUntilDate, setTempUntilDate] = useState(new Date());

  const [loading, setLoading] = useState(false);
  const { activeTeamId } = useTeam();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl * 2,
    },
    backButton: {
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: colors.cardLight,
      color: colors.text,
      borderRadius: 12,
      padding: spacing.md,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    typeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm + 2,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeActive: {
      borderColor: 'transparent',
    },
    trainingActive: {
      backgroundColor: '#00b894',
    },
    matchActive: {
      backgroundColor: colors.accent,
    },
    typeText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '600',
    },
    repeatButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm + 2,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    repeatText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    previewText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.cardLight,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerText: {
      fontSize: 16,
      color: colors.text,
    },
    pickerPlaceholder: {
      color: colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: spacing.lg,
      width: '85%',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
      width: '100%',
    },
    modalButton: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.cardLight,
    },
    modalButtonCancel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    modalButtonOk: {
      backgroundColor: colors.accent,
    },
    modalButtonOkText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: spacing.md,
      alignItems: 'center',
      marginTop: spacing.xl,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
  }), [colors]);

  // Clear untilDate if eventDate changes to after it
  useEffect(() => {
    if (eventDate && untilDate && eventDate.getTime() >= untilDate.getTime()) {
      setUntilDate(null);
    }
  }, [eventDate]);

  // Compute occurrences for preview
  const occurrences = useMemo(() => {
    if (repeatMode === 'none' || !eventDate || !untilDate) return null;
    const start = new Date(
      eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(),
      eventTime.getHours(), eventTime.getMinutes()
    );
    return generateOccurrences(start, repeatMode, untilDate);
  }, [eventDate, eventTime, repeatMode, untilDate]);

  const occurrenceCount = occurrences?.length || 0;

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }
    if (!eventDate) {
      Alert.alert('Error', 'Please select a date');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }
    if (repeatMode !== 'none' && !untilDate) {
      Alert.alert('Error', 'Please select an end date for the recurring event');
      return;
    }

    const hour = eventTime.getHours();
    const minute = eventTime.getMinutes();

    const startDate = new Date(
      eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(),
      hour, minute
    );

    setLoading(true);
    try {
      const baseEventData: any = {
        type,
        title: title.trim(),
        location: location.trim(),
        createdBy: auth.currentUser?.uid || '',
        createdAt: serverTimestamp(),
      };
      if (type === 'match') {
        baseEventData.opponent = opponent.trim();
        baseEventData.isHome = isHome;
      }

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const typeLabel = type === 'match' ? 'Match' : 'Training';

      if (repeatMode === 'none') {
        // Single event — existing behavior
        await addDoc(collection(db, 'teams', activeTeamId!, 'events'), {
          ...baseEventData,
          date: Timestamp.fromDate(startDate),
        });

        const dateFormatted = `${months[startDate.getMonth()]} ${startDate.getDate()}. ${days[startDate.getDay()]} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const chatText = `New ${typeLabel.toLowerCase()}: "${title.trim()}"\n\n  ${dateFormatted}\n  ${location.trim()}`;

        await addDoc(collection(db, 'teams', activeTeamId!, 'messages'), {
          text: chatText,
          senderId: 'system',
          senderName: 'Calendar',
          createdAt: serverTimestamp(),
          type: 'system',
        });
      } else {
        // Recurring — batch create
        const dates = generateOccurrences(startDate, repeatMode, untilDate!);
        const batch = writeBatch(db);

        for (const d of dates) {
          const ref = doc(collection(db, 'teams', activeTeamId!, 'events'));
          batch.set(ref, {
            ...baseEventData,
            date: Timestamp.fromDate(d),
          });
        }

        await batch.commit();

        // Single chat message for the series
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        const firstFormatted = `${months[firstDate.getMonth()]} ${firstDate.getDate()}.`;
        const lastFormatted = `${months[lastDate.getMonth()]} ${lastDate.getDate()}.`;
        const repeatLabel = repeatMode === 'weekly' ? 'weekly' : 'every 2 weeks';
        const chatText = `New recurring ${typeLabel.toLowerCase()}: "${title.trim()}"\n\n  ${firstFormatted} — ${lastFormatted}\n  ${repeatLabel}, ${dates.length} events\n  ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}, ${location.trim()}`;

        await addDoc(collection(db, 'teams', activeTeamId!, 'messages'), {
          text: chatText,
          senderId: 'system',
          senderName: 'Calendar',
          createdAt: serverTimestamp(),
          type: 'system',
        });
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  // Max until date = 1 year from event date
  const maxUntilDate = eventDate
    ? new Date(eventDate.getFullYear() + 1, eventDate.getMonth(), eventDate.getDate())
    : new Date(Date.now() + 365 * 86400000);

  // Min until date = day after event date
  const minUntilDate = eventDate
    ? new Date(eventDate.getTime() + 86400000)
    : new Date(Date.now() + 86400000);

  // Submit button text
  const submitText = loading
    ? 'Creating...'
    : repeatMode !== 'none' && occurrenceCount > 0
      ? `Create ${occurrenceCount} events`
      : 'Create event';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>New event</Text>

      {/* Type selector */}
      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeButton, type === 'training' && styles.typeActive, type === 'training' && styles.trainingActive]}
          onPress={() => setType('training')}
        >
          <Ionicons name="fitness-outline" size={18} color={colors.text} />
          <Text style={styles.typeText}>Training</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, type === 'match' && styles.typeActive, type === 'match' && styles.matchActive]}
          onPress={() => setType('match')}
        >
          <Ionicons name="basketball-outline" size={18} color={colors.text} />
          <Text style={styles.typeText}>Match</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder={type === 'match' ? 'e.g. Team vs Opponent' : 'e.g. Tuesday practice'}
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
      />

      {/* Date */}
      <Text style={styles.label}>Date</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => { setTempDate(eventDate || new Date()); setShowDatePicker(true); }}
      >
        <Ionicons name="calendar-outline" size={18} color={eventDate ? colors.text : colors.textSecondary} />
        <Text style={[styles.pickerText, !eventDate && styles.pickerPlaceholder]}>
          {eventDate ? eventDate.toISOString().split('T')[0] : 'Select date'}
        </Text>
      </TouchableOpacity>

      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select date</Text>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={(_e: DateTimePickerEvent, d?: Date) => { if (d) setTempDate(d); }}
              textColor={colors.text}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalButtonCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonOk]} onPress={() => { setEventDate(tempDate); setShowDatePicker(false); }}>
                <Text style={styles.modalButtonOkText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time */}
      <Text style={styles.label}>Time</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => { setTempTime(eventTime); setShowTimePicker(true); }}
      >
        <Ionicons name="time-outline" size={18} color={colors.text} />
        <Text style={styles.pickerText}>
          {`${String(eventTime.getHours()).padStart(2, '0')}:${String(eventTime.getMinutes()).padStart(2, '0')}`}
        </Text>
      </TouchableOpacity>

      <Modal visible={showTimePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select time</Text>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display="spinner"
              onChange={(_e: DateTimePickerEvent, d?: Date) => { if (d) setTempTime(d); }}
              textColor={colors.text}
              is24Hour={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalButtonCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonOk]} onPress={() => { setEventTime(tempTime); setShowTimePicker(false); }}>
                <Text style={styles.modalButtonOkText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Repeat */}
      <Text style={styles.label}>Repeat</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.repeatButton, repeatMode === 'none' && styles.typeActive, repeatMode === 'none' && { backgroundColor: colors.textSecondary }]}
          onPress={() => { setRepeatMode('none'); setUntilDate(null); }}
        >
          <Text style={styles.repeatText}>No repeat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.repeatButton, repeatMode === 'weekly' && styles.typeActive, repeatMode === 'weekly' && { backgroundColor: colors.accent }]}
          onPress={() => setRepeatMode('weekly')}
        >
          <Text style={styles.repeatText}>Weekly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.repeatButton, repeatMode === 'biweekly' && styles.typeActive, repeatMode === 'biweekly' && { backgroundColor: colors.accent }]}
          onPress={() => setRepeatMode('biweekly')}
        >
          <Text style={styles.repeatText}>Every 2w</Text>
        </TouchableOpacity>
      </View>

      {/* Until date (only when repeating) */}
      {repeatMode !== 'none' && (
        <>
          <Text style={styles.label}>Until</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => { setTempUntilDate(untilDate || minUntilDate); setShowUntilPicker(true); }}
          >
            <Ionicons name="calendar-outline" size={18} color={untilDate ? colors.text : colors.textSecondary} />
            <Text style={[styles.pickerText, !untilDate && styles.pickerPlaceholder]}>
              {untilDate ? untilDate.toISOString().split('T')[0] : 'Select end date'}
            </Text>
          </TouchableOpacity>

          <Modal visible={showUntilPicker} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Repeat until</Text>
                <DateTimePicker
                  value={tempUntilDate}
                  mode="date"
                  display="spinner"
                  onChange={(_e: DateTimePickerEvent, d?: Date) => { if (d) setTempUntilDate(d); }}
                  minimumDate={minUntilDate}
                  maximumDate={maxUntilDate}
                  textColor={colors.text}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalButton} onPress={() => setShowUntilPicker(false)}>
                    <Text style={styles.modalButtonCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.modalButtonOk]} onPress={() => { setUntilDate(tempUntilDate); setShowUntilPicker(false); }}>
                    <Text style={styles.modalButtonOkText}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Occurrence count preview */}
          {occurrenceCount > 0 && (
            <View style={styles.previewRow}>
              <Ionicons name="repeat-outline" size={14} color={occurrenceCount > MAX_OCCURRENCES ? colors.error : colors.textSecondary} />
              <Text style={[styles.previewText, occurrenceCount > MAX_OCCURRENCES && { color: colors.error }]}>
                {occurrenceCount > MAX_OCCURRENCES
                  ? `Maximum ${MAX_OCCURRENCES} events (reduce date range)`
                  : `${occurrenceCount} events will be created`}
              </Text>
            </View>
          )}
        </>
      )}

      {/* Location */}
      <Text style={styles.label}>Location</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Sports hall"
        placeholderTextColor={colors.textSecondary}
        value={location}
        onChangeText={setLocation}
      />

      {/* Match-specific */}
      {type === 'match' && (
        <>
          <Text style={styles.label}>Opponent</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Vasas"
            placeholderTextColor={colors.textSecondary}
            value={opponent}
            onChangeText={setOpponent}
          />

          <Text style={styles.label}>Court</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeButton, isHome && styles.typeActive, isHome && { backgroundColor: '#00b894' }]}
              onPress={() => setIsHome(true)}
            >
              <Text style={styles.typeText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, !isHome && styles.typeActive, !isHome && { backgroundColor: colors.accent }]}
              onPress={() => setIsHome(false)}
            >
              <Text style={styles.typeText}>Away</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.submitText}>{submitText}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
