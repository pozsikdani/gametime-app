import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

export default function JoinTeamScreen() {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    input: {
      width: '100%',
      backgroundColor: colors.card,
      color: colors.text,
      borderRadius: 12,
      padding: spacing.md,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: 'center',
      letterSpacing: 2,
      marginBottom: spacing.md,
    },
    button: {
      width: '100%',
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: spacing.md,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    logoutLink: {
      marginTop: spacing.xl,
    },
    logoutText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
  }), [colors]);

  const handleJoin = async () => {
    if (!user || !code.trim()) return;

    setLoading(true);
    try {
      // Find team by invite code
      const q = query(
        collection(db, 'teams'),
        where('inviteCode', '==', code.trim().toLowerCase())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert('Error', 'Invalid invite code');
        setLoading(false);
        return;
      }

      const teamDoc = snap.docs[0];
      const teamId = teamDoc.id;

      // Create membership
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

      // Update user's teamIds
      await updateDoc(doc(db, 'users', user.uid), {
        teamIds: arrayUnion(teamId),
        lastActiveTeamId: teamId,
      });

      // TeamContext will pick up the change via onSnapshot
    } catch (e) {
      Alert.alert('Error', 'Failed to join team');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="people" size={64} color={colors.accent} />
        <Text style={styles.title}>Join a team</Text>
        <Text style={styles.subtitle}>
          Enter a team invite code to join
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Invite code"
          placeholderTextColor={colors.textSecondary}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.button, (!code.trim() || loading) && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={!code.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.buttonText}>Join</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutLink} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
