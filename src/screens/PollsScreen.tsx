import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { Poll } from '../types';
import { colors, spacing } from '../constants/theme';
import { useAdmin } from '../hooks/useAdmin';
import { useTeam } from '../contexts/TeamContext';

type Props = {
  navigation: any;
};

export default function PollsScreen({ navigation }: Props) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAdmin();
  const { activeTeamId } = useTeam();

  useEffect(() => {
    const q = query(
      collection(db, 'teams', activeTeamId!, 'polls'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Poll[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Poll[];
      setPolls(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [activeTeamId]);

  const activePolls = polls.filter((p) => !p.closed);
  const closedPolls = polls.filter((p) => p.closed);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Polls</Text>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => navigation.navigate('CreatePoll')}
            style={styles.addButton}
          >
            <Ionicons name="add-circle" size={28} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={[
          ...(activePolls.length > 0
            ? [{ id: '__header_active', _isHeader: true, _title: `Active (${activePolls.length})` } as any]
            : []),
          ...activePolls,
          ...(closedPolls.length > 0
            ? [{ id: '__header_closed', _isHeader: true, _title: `Closed (${closedPolls.length})` } as any]
            : []),
          ...closedPolls,
        ]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (item._isHeader) {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{item._title}</Text>
              </View>
            );
          }

          const poll = item as Poll;
          return (
            <TouchableOpacity
              style={[styles.pollCard, poll.closed && styles.pollCardClosed]}
              onPress={() => navigation.navigate('PollDetail', { pollId: poll.id })}
            >
              <View style={styles.pollIcon}>
                <Ionicons
                  name={poll.closed ? 'checkmark-circle' : 'bar-chart-outline'}
                  size={22}
                  color={poll.closed ? colors.textSecondary : colors.accent}
                />
              </View>
              <View style={styles.pollContent}>
                <Text style={[styles.pollQuestion, poll.closed && styles.closedText]}>
                  {poll.question}
                </Text>
                <Text style={styles.pollMeta}>
                  {poll.options.length} options
                  {poll.closed ? ' · Closed' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No polls</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    padding: spacing.xs,
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pollCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
  },
  pollCardClosed: {
    opacity: 0.5,
  },
  pollIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(196, 30, 58, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  pollContent: {
    flex: 1,
  },
  pollQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  closedText: {
    color: colors.textSecondary,
  },
  pollMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
