import React, { useState } from 'react';
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
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { EventType } from '../types';
import { colors, spacing } from '../constants/theme';
import { useTeam } from '../contexts/TeamContext';

type Props = {
  navigation: any;
};

export default function CreateEventScreen({ navigation }: Props) {
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
  const [loading, setLoading] = useState(false);
  const { activeTeamId } = useTeam();

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

    const date = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
      eventTime.getHours(),
      eventTime.getMinutes()
    );
    const hour = eventTime.getHours();
    const minute = eventTime.getMinutes();

    setLoading(true);
    try {
      const eventData: any = {
        type,
        title: title.trim(),
        date: Timestamp.fromDate(date),
        location: location.trim(),
        createdBy: auth.currentUser?.uid || '',
        createdAt: serverTimestamp(),
      };

      if (type === 'match') {
        eventData.opponent = opponent.trim();
        eventData.isHome = isHome;
      }

      await addDoc(collection(db, 'teams', activeTeamId!, 'events'), eventData);

      // Chat log
      const typeLabel = type === 'match' ? 'Match' : 'Training';
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateFormatted = `${months[date.getMonth()]} ${date.getDate()}. ${days[date.getDay()]} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const chatText = `New ${typeLabel.toLowerCase()}: "${title.trim()}"\n\n  ${dateFormatted}\n  ${location.trim()}`;

      await addDoc(collection(db, 'teams', activeTeamId!, 'messages'), {
        text: chatText,
        senderId: 'system',
        senderName: 'Calendar',
        createdAt: serverTimestamp(),
        type: 'system',
      });

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

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
            placeholder="pl. Vasas"
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
        <Text style={styles.submitText}>
          {loading ? 'Creating...' : 'Create event'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
