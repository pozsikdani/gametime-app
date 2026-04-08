import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { APP_NAME } from '../constants/config';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function InviteScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    input: {
      backgroundColor: colors.cardLight,
      color: colors.text,
      borderRadius: 12,
      padding: spacing.md,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    error: {
      color: colors.error,
      fontSize: 14,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    link: {
      color: colors.accent,
      fontSize: 14,
      textAlign: 'center',
    },
  }), [colors]);

  const handleSubmit = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      // Look up team by invite code in Firestore
      const q = query(
        collection(db, 'teams'),
        where('inviteCode', '==', code.trim().toLowerCase())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('Invalid invite code');
        setLoading(false);
        return;
      }

      const teamDoc = snap.docs[0];
      const teamId = teamDoc.id;
      const teamName = teamDoc.data().name;

      // Pass team info to Register screen
      navigation.navigate('Register', { teamId, teamName });
    } catch (e) {
      setError('An error occurred during verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>Enter your invite code</Text>

        <TextInput
          style={styles.input}
          placeholder="Invite code"
          placeholderTextColor={colors.textSecondary}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSubmit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
