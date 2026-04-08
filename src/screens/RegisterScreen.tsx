import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, arrayUnion, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: any;
};

export default function RegisterScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { teamId, teamName } = route.params || {};
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    teamName: {
      fontSize: 15,
      color: colors.accent,
      textAlign: 'center',
      marginBottom: spacing.xl,
      fontWeight: '600',
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

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(user, { displayName: displayName.trim() });

      // Create global user document with teamIds
      await setDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        email: email.trim(),
        createdAt: serverTimestamp(),
        teamIds: teamId ? [teamId] : [],
        lastActiveTeamId: teamId || null,
      });

      // Create team membership if invited to a team
      if (teamId) {
        await setDoc(doc(db, 'teams', teamId, 'members', user.uid), {
          displayName: displayName.trim(),
          role: 'player',
          jerseyNumber: '',
          position: [],
          height: '',
          weight: '',
          phone: '',
          jerseySize: '',
          idNumber: '',
          medicalExpiry: '',
          joinedAt: serverTimestamp(),
        });
      }
    } catch (e: any) {
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'This email is already taken',
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password must be at least 6 characters',
      };
      setError(messages[e.code] || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Sign up</Text>
        {teamName && (
          <Text style={styles.teamName}>Team: {teamName}</Text>
        )}

        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing up...' : 'Sign up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
