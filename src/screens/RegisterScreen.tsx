import React, { useState } from 'react';
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
import { colors, spacing } from '../constants/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: any;
};

export default function RegisterScreen({ navigation, route }: Props) {
  const { teamId, teamName } = route.params || {};
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      setError('Minden mező kitöltése kötelező');
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
          role: 'player',
          jerseyNumber: '',
          position: [],
          height: '',
          weight: '',
          phone: '',
          jerseySize: '',
          idNumber: '',
          joinedAt: serverTimestamp(),
        });
      }
    } catch (e: any) {
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Ez az email cím már foglalt',
        'auth/invalid-email': 'Érvénytelen email cím',
        'auth/weak-password': 'A jelszónak legalább 6 karakter hosszúnak kell lennie',
      };
      setError(messages[e.code] || 'Hiba történt a regisztráció során');
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
        <Text style={styles.title}>Regisztráció</Text>
        {teamName && (
          <Text style={styles.teamName}>Csapat: {teamName}</Text>
        )}

        <TextInput
          style={styles.input}
          placeholder="Név"
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
          placeholder="Jelszó"
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
            {loading ? 'Regisztráció...' : 'Regisztráció'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Már van fiókod? Jelentkezz be</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
});
