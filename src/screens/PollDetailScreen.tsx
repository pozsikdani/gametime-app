import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  doc,
  onSnapshot,
  collection,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { Poll, PollVote } from '../types';
import { colors, spacing } from '../constants/theme';
import { useAdmin } from '../hooks/useAdmin';
import { useTeam } from '../contexts/TeamContext';

type Props = {
  route: any;
  navigation: any;
};

export default function PollDetailScreen({ route, navigation }: Props) {
  const { pollId } = route.params;
  const [poll, setPoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<(PollVote & { userId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const currentUser = auth.currentUser;
  const isAdmin = useAdmin();
  const { activeTeamId } = useTeam();

  useEffect(() => {
    const unsubPoll = onSnapshot(doc(db, 'teams', activeTeamId!, 'polls', pollId), (docSnap) => {
      if (docSnap.exists()) {
        setPoll({ id: docSnap.id, ...docSnap.data() } as Poll);
      }
      setLoading(false);
    });
    return unsubPoll;
  }, [pollId]);

  useEffect(() => {
    const q = query(collection(db, 'teams', activeTeamId!, 'polls', pollId, 'votes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        ...d.data(),
        userId: d.id,
      })) as (PollVote & { userId: string })[];
      setVotes(items);
    });
    return unsubscribe;
  }, [pollId]);

  const myVote = votes.find((v) => v.userId === currentUser?.uid);
  const totalVotes = votes.length;
  const isMultiple = poll?.multipleChoice ?? false;

  const handleVote = async (optionId: string) => {
    if (!currentUser || poll?.closed) return;

    setVoting(true);
    try {
      let newOptionIds: string[];

      if (isMultiple) {
        const current = myVote?.optionIds || [];
        if (current.includes(optionId)) {
          newOptionIds = current.filter((id) => id !== optionId);
        } else {
          newOptionIds = [...current, optionId];
        }
      } else {
        newOptionIds = [optionId];
      }

      if (newOptionIds.length === 0) {
        await deleteDoc(doc(db, 'teams', activeTeamId!, 'polls', pollId, 'votes', currentUser.uid));
      } else {
        await setDoc(doc(db, 'teams', activeTeamId!, 'polls', pollId, 'votes', currentUser.uid), {
          optionIds: newOptionIds,
          userName: currentUser.displayName || 'Ismeretlen',
          votedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      Alert.alert('Hiba', 'Nem sikerült szavazni');
    } finally {
      setVoting(false);
    }
  };

  const handleToggleClose = async () => {
    if (!poll || !isAdmin) return;
    const action = poll.closed ? 'újranyitni' : 'lezárni';
    Alert.alert('Megerősítés', `Biztosan szeretnéd ${action} a szavazást?`, [
      { text: 'Mégsem', style: 'cancel' },
      {
        text: poll.closed ? 'Újranyitás' : 'Lezárás',
        onPress: async () => {
          await updateDoc(doc(db, 'teams', activeTeamId!, 'polls', pollId), { closed: !poll.closed });

          // Send poll result to chat when closing
          if (!poll.closed && currentUser) {
            const totalV = votes.length;
            const resultLines = poll.options.map((opt) => {
              const count = votes.filter((v) => (v.optionIds || []).includes(opt.id)).length;
              const pct = totalV > 0 ? Math.round((count / totalV) * 100) : 0;
              return `  ${opt.text}: ${count} szavazat (${pct}%)`;
            });

            const chatText = `"${poll.question}"\n\n${resultLines.join('\n')}\n\nÖsszesen ${totalV} szavazó.`;

            await addDoc(collection(db, 'teams', activeTeamId!, 'messages'), {
              text: chatText,
              senderId: 'system',
              senderName: 'Szavazás',
              createdAt: serverTimestamp(),
              type: 'system',
            });
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!isAdmin) return;
    Alert.alert('Törlés', 'Biztosan törlöd a szavazást?', [
      { text: 'Mégsem', style: 'cancel' },
      {
        text: 'Törlés',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'teams', activeTeamId!, 'polls', pollId));
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading || !poll) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const hasVoted = !!myVote && (myVote.optionIds || []).length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={[styles.statusBadge, poll.closed ? styles.closedBadge : styles.activeBadge]}>
        <Ionicons
          name={poll.closed ? 'lock-closed' : 'bar-chart-outline'}
          size={16}
          color={colors.text}
        />
        <Text style={styles.statusText}>{poll.closed ? 'Lezárt' : 'Aktív'}</Text>
      </View>

      <Text style={styles.question}>{poll.question}</Text>

      <Text style={styles.voteCount}>
        {totalVotes} szavazó{isMultiple ? ' · Több válasz' : ''}
      </Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {poll.options.map((option) => {
          const optionVotes = votes.filter((v) => (v.optionIds || []).includes(option.id));
          const count = optionVotes.length;
          const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMyVote = (myVote?.optionIds || []).includes(option.id);
          const canVote = !poll.closed && !voting;

          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionCard, isMyVote && styles.optionCardSelected]}
              onPress={() => canVote ? handleVote(option.id) : null}
              activeOpacity={canVote ? 0.7 : 1}
            >
              {/* Progress bar background */}
              {(hasVoted || poll.closed) && (
                <View
                  style={[
                    styles.progressBar,
                    isMyVote ? styles.progressBarSelected : styles.progressBarDefault,
                    { width: `${percentage}%` },
                  ]}
                />
              )}

              <View style={styles.optionContent}>
                <View style={styles.optionLeft}>
                  {isMyVote && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                  )}
                  <Text style={[styles.optionText, isMyVote && styles.optionTextSelected]}>
                    {option.text}
                  </Text>
                </View>

                {(hasVoted || poll.closed) && (
                  <Text style={[styles.percentage, isMyVote && styles.percentageSelected]}>
                    {count} ({percentage}%)
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Voter names (visible after voting or when closed) */}
      {(hasVoted || poll.closed) && totalVotes > 0 && (
        <View style={styles.votersSection}>
          <Text style={styles.sectionTitle}>Szavazók</Text>
          {poll.options.map((option) => {
            const optionVotes = votes.filter((v) => (v.optionIds || []).includes(option.id));
            if (optionVotes.length === 0) return null;
            return (
              <View key={option.id} style={styles.voterGroup}>
                <Text style={styles.voterGroupTitle}>{option.text}:</Text>
                <Text style={styles.voterNames}>
                  {optionVotes.map((v) => v.userName).join(', ')}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Admin actions */}
      {isAdmin && (
        <View style={styles.adminActions}>
          <TouchableOpacity style={styles.adminButton} onPress={handleToggleClose}>
            <Ionicons
              name={poll.closed ? 'lock-open-outline' : 'lock-closed-outline'}
              size={18}
              color={poll.closed ? '#00b894' : '#fdcb6e'}
            />
            <Text style={[styles.adminButtonText, { color: poll.closed ? '#00b894' : '#fdcb6e' }]}>
              {poll.closed ? 'Újranyitás' : 'Lezárás'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.adminButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.adminButtonText, { color: colors.error }]}>Törlés</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  activeBadge: {
    backgroundColor: colors.accent,
  },
  closedBadge: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  voteCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  optionsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  optionCardSelected: {
    borderColor: colors.accent,
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 11,
  },
  progressBarDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  progressBarSelected: {
    backgroundColor: 'rgba(196, 30, 58, 0.2)',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  optionTextSelected: {
    fontWeight: '700',
  },
  percentage: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  percentageSelected: {
    color: colors.accent,
  },
  votersSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  voterGroup: {
    marginBottom: spacing.sm,
  },
  voterGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  voterNames: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  adminActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  adminButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
