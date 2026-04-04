import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { colors, spacing } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTeam } from '../contexts/TeamContext';
import { useAdmin } from '../hooks/useAdmin';
import { TeamRole } from '../types';

interface MemberItem {
  userId: string;
  displayName: string;
  role: TeamRole;
  jerseyNumber?: string;
  position?: string[];
  medicalExpiry?: string;
  joinedAt?: any;
}

function getMedicalStatus(expiry?: string): { label: string; color: string } | null {
  if (!expiry) return { label: 'Not set', color: colors.textSecondary };
  const now = new Date();
  const exp = new Date(expiry);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Expired!', color: colors.error };
  if (daysLeft <= 14) return { label: `${daysLeft} days`, color: colors.error };
  if (daysLeft <= 30) return { label: `${daysLeft} days`, color: '#fdcb6e' };
  if (daysLeft <= 60) return { label: `${daysLeft} days`, color: '#fdcb6e' };
  return { label: expiry, color: colors.success };
}

const ROLE_LABELS: Record<TeamRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
  player: 'Player',
  guest: 'Guest',
};

const ROLE_ICONS: Record<TeamRole, string> = {
  admin: 'shield-checkmark',
  coach: 'clipboard-outline',
  player: 'basketball-outline',
  guest: 'eye-outline',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  admin: colors.accent,
  coach: '#fdcb6e',
  player: '#00b894',
  guest: colors.textSecondary,
};

const ROLE_ORDER: TeamRole[] = ['admin', 'coach', 'player', 'guest'];

export default function MembersScreen({ navigation }: any) {
  const { activeTeamId } = useTeam();
  const isAdmin = useAdmin();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTeamId) return;

    const q = query(collection(db, 'teams', activeTeamId, 'members'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: MemberItem[] = snapshot.docs.map((d) => ({
        userId: d.id,
        displayName: d.data().displayName || 'Ismeretlen',
        role: d.data().role || 'player',
        jerseyNumber: d.data().jerseyNumber || '',
        position: d.data().position || [],
        medicalExpiry: d.data().medicalExpiry || '',
        joinedAt: d.data().joinedAt,
      }));

      items.sort((a, b) => {
        const orderA = ROLE_ORDER.indexOf(a.role);
        const orderB = ROLE_ORDER.indexOf(b.role);
        if (orderA !== orderB) return orderA - orderB;
        return a.displayName.localeCompare(b.displayName);
      });

      setMembers(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [activeTeamId]);

  const renderMember = ({ item }: { item: MemberItem }) => {
    const roleColor = ROLE_COLORS[item.role];
    const roleIcon = ROLE_ICONS[item.role];
    const roleLabel = ROLE_LABELS[item.role];
    const medical = getMedicalStatus(item.medicalExpiry);

    return (
      <TouchableOpacity
        style={styles.memberCard}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('MemberDetail', {
            userId: item.userId,
            displayName: item.displayName,
          })
        }
      >
        <View style={[styles.avatar, { borderColor: roleColor }]}>
          <Text style={styles.avatarText}>
            {item.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.displayName}</Text>
          <View style={styles.memberMeta}>
            <View style={[styles.rolePill, { borderColor: roleColor }]}>
              <Ionicons name={roleIcon as any} size={12} color={roleColor} />
              <Text style={[styles.roleText, { color: roleColor }]}>
                {roleLabel}
              </Text>
            </View>
            {item.jerseyNumber ? (
              <Text style={styles.jerseyText}>#{item.jerseyNumber}</Text>
            ) : null}
          </View>
          {medical && (
            <View style={styles.medicalRow}>
              <Ionicons name="medical-outline" size={12} color={medical.color} />
              <Text style={[styles.medicalText, { color: medical.color }]}>
                {medical.label}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Team members</Text>
        <Text style={styles.countBadge}>{members.length} members</Text>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.userId}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No members</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  countBadge: {
    fontSize: 14,
    color: colors.textSecondary,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    overflow: 'hidden',
  },
  list: {
    padding: spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardLight,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jerseyText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  medicalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  medicalText: {
    fontSize: 11,
    fontWeight: '600',
  },
  separator: {
    height: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
