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
} from 'react-native';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
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
  const [dateStr, setDateStr] = useState('');  // "2025-10-15"
  const [timeStr, setTimeStr] = useState('20:00');
  const [loading, setLoading] = useState(false);
  const { activeTeamId } = useTeam();

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Hiba', 'Add meg az esemény nevét');
      return;
    }
    if (!dateStr.trim()) {
      Alert.alert('Hiba', 'Add meg a dátumot (ÉÉÉÉ-HH-NN)');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Hiba', 'Add meg a helyszínt');
      return;
    }

    // Parse date
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    if (!year || !month || !day || isNaN(hour) || isNaN(minute)) {
      Alert.alert('Hiba', 'Érvénytelen dátum vagy idő formátum');
      return;
    }

    const date = new Date(year, month - 1, day, hour, minute);

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
      const typeLabel = type === 'match' ? 'Meccs' : 'Edzés';
      const days = ['Vas', 'Hét', 'Kedd', 'Sze', 'Csüt', 'Pén', 'Szo'];
      const months = ['jan', 'feb', 'már', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
      const dateFormatted = `${months[date.getMonth()]} ${date.getDate()}. ${days[date.getDay()]} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const chatText = `Új ${typeLabel.toLowerCase()}: "${title.trim()}"\n\n  ${dateFormatted}\n  ${location.trim()}`;

      await addDoc(collection(db, 'teams', activeTeamId!, 'messages'), {
        text: chatText,
        senderId: 'system',
        senderName: 'Naptár',
        createdAt: serverTimestamp(),
        type: 'system',
      });

      navigation.goBack();
    } catch (e) {
      Alert.alert('Hiba', 'Nem sikerült létrehozni az eseményt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Új esemény</Text>

      {/* Type selector */}
      <Text style={styles.label}>Típus</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeButton, type === 'training' && styles.typeActive, type === 'training' && styles.trainingActive]}
          onPress={() => setType('training')}
        >
          <Ionicons name="fitness-outline" size={18} color={colors.text} />
          <Text style={styles.typeText}>Edzés</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, type === 'match' && styles.typeActive, type === 'match' && styles.matchActive]}
          onPress={() => setType('match')}
        >
          <Ionicons name="basketball-outline" size={18} color={colors.text} />
          <Text style={styles.typeText}>Meccs</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.label}>Név</Text>
      <TextInput
        style={styles.input}
        placeholder={type === 'match' ? 'pl. Közgáz vs Vasas' : 'pl. Kedd esti edzés'}
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
      />

      {/* Date & Time */}
      <Text style={styles.label}>Dátum (ÉÉÉÉ-HH-NN)</Text>
      <TextInput
        style={styles.input}
        placeholder="2025-10-15"
        placeholderTextColor={colors.textSecondary}
        value={dateStr}
        onChangeText={setDateStr}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>Időpont (ÓÓ:PP)</Text>
      <TextInput
        style={styles.input}
        placeholder="20:00"
        placeholderTextColor={colors.textSecondary}
        value={timeStr}
        onChangeText={setTimeStr}
        keyboardType="numbers-and-punctuation"
      />

      {/* Location */}
      <Text style={styles.label}>Helyszín</Text>
      <TextInput
        style={styles.input}
        placeholder="pl. Közgáz tornaterem"
        placeholderTextColor={colors.textSecondary}
        value={location}
        onChangeText={setLocation}
      />

      {/* Match-specific */}
      {type === 'match' && (
        <>
          <Text style={styles.label}>Ellenfél</Text>
          <TextInput
            style={styles.input}
            placeholder="pl. Vasas"
            placeholderTextColor={colors.textSecondary}
            value={opponent}
            onChangeText={setOpponent}
          />

          <Text style={styles.label}>Pálya</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeButton, isHome && styles.typeActive, isHome && { backgroundColor: '#00b894' }]}
              onPress={() => setIsHome(true)}
            >
              <Text style={styles.typeText}>Hazai</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, !isHome && styles.typeActive, !isHome && { backgroundColor: colors.accent }]}
              onPress={() => setIsHome(false)}
            >
              <Text style={styles.typeText}>Idegen</Text>
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
          {loading ? 'Létrehozás...' : 'Esemény létrehozása'}
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
