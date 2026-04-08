import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useTeam } from '../contexts/TeamContext';

type Props = {
  navigation: any;
};

export default function CreatePollScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
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
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    optionInput: {
      flex: 1,
    },
    removeButton: {
      padding: spacing.xs,
    },
    addOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    addOptionText: {
      fontSize: 15,
      color: colors.accent,
      fontWeight: '600',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cardLight,
      borderRadius: 12,
      padding: spacing.md,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    switchLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    switchText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
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

  const addOption = () => {
    if (options.length >= 8) {
      Alert.alert('Error', 'Maximum 8 options allowed');
      return;
    }
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      Alert.alert('Error', 'Minimum 2 options required');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const handleCreate = async () => {
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      Alert.alert('Error', 'At least 2 options are required');
      return;
    }

    setLoading(true);
    try {
      const pollOptions = validOptions.map((text, i) => ({
        id: `opt_${i}_${Date.now()}`,
        text: text.trim(),
      }));

      await addDoc(collection(db, 'teams', activeTeamId!, 'polls'), {
        question: question.trim(),
        options: pollOptions,
        createdBy: auth.currentUser?.uid || '',
        createdAt: serverTimestamp(),
        closed: false,
        multipleChoice,
      });

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>New poll</Text>

      <Text style={styles.label}>Question</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. When should we have the team building?"
        placeholderTextColor={colors.textSecondary}
        value={question}
        onChangeText={setQuestion}
        multiline
      />

      <Text style={styles.label}>Options</Text>
      {options.map((opt, i) => (
        <View key={i} style={styles.optionRow}>
          <TextInput
            style={[styles.input, styles.optionInput]}
            placeholder={`Option ${i + 1}`}
            placeholderTextColor={colors.textSecondary}
            value={opt}
            onChangeText={(text) => updateOption(i, text)}
          />
          {options.length > 2 && (
            <TouchableOpacity onPress={() => removeOption(i)} style={styles.removeButton}>
              <Ionicons name="close-circle" size={24} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity style={styles.addOptionButton} onPress={addOption}>
        <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
        <Text style={styles.addOptionText}>Add option</Text>
      </TouchableOpacity>

      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Ionicons name="checkbox-outline" size={20} color={colors.text} />
          <Text style={styles.switchText}>Allow multiple answers</Text>
        </View>
        <Switch
          value={multipleChoice}
          onValueChange={setMultipleChoice}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.text}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        <Text style={styles.submitText}>
          {loading ? 'Creating...' : 'Create poll'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
