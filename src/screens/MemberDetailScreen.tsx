import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { colors, spacing } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTeam } from '../contexts/TeamContext';
import { useAdmin } from '../hooks/useAdmin';
import { TeamRole } from '../types';

const ROLE_LABELS: Record<TeamRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
  player: 'Player',
  guest: 'Guest',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  admin: colors.accent,
  coach: '#fdcb6e',
  player: '#00b894',
  guest: colors.textSecondary,
};

const ROLE_ICONS: Record<TeamRole, string> = {
  admin: 'shield-checkmark',
  coach: 'clipboard-outline',
  player: 'basketball-outline',
  guest: 'eye-outline',
};

const ASSIGNABLE_ROLES: { label: string; value: TeamRole }[] = [
  { label: 'Admin', value: 'admin' },
  { label: 'Coach', value: 'coach' },
  { label: 'Player', value: 'player' },
  { label: 'Guest', value: 'guest' },
];

interface MemberProfile {
  displayName: string;
  role: TeamRole;
  jerseyNumber: string;
  position: string[];
  height: string;
  weight: string;
  phone: string;
  jerseySize: string;
  idNumber: string;
  medicalExpiry: string;
  licenseCardURL?: string;
  joinedAt?: any;
}

interface UserGlobal {
  email?: string;
  photoURL?: string;
}

export default function MemberDetailScreen({ route, navigation }: any) {
  const { userId, displayName: navName } = route.params;
  const { activeTeamId } = useTeam();
  const isAdmin = useAdmin();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [userGlobal, setUserGlobal] = useState<UserGlobal>({});
  const [loading, setLoading] = useState(true);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  useEffect(() => {
    if (!activeTeamId) return;

    const loadData = async () => {
      try {
        // Load team membership
        const memberDoc = await getDoc(
          doc(db, 'teams', activeTeamId, 'members', userId)
        );
        if (memberDoc.exists()) {
          const d = memberDoc.data();
          setProfile({
            displayName: d.displayName || navName || 'Ismeretlen',
            role: d.role || 'player',
            jerseyNumber: d.jerseyNumber || '',
            position: d.position || [],
            height: d.height || '',
            weight: d.weight || '',
            phone: d.phone || '',
            jerseySize: d.jerseySize || '',
            idNumber: d.idNumber || '',
            medicalExpiry: d.medicalExpiry || '',
            licenseCardURL: d.licenseCardURL || undefined,
            joinedAt: d.joinedAt,
          });
        }

        // Load global user data (email, photo)
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const u = userDoc.data();
          setUserGlobal({
            email: u.email || '',
            photoURL: u.photoURL || '',
          });
        }
      } catch (err) {
        console.error('Error loading member:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTeamId, userId]);

  const handleChangeRole = () => {
    if (!profile || !isAdmin) return;

    const options = ASSIGNABLE_ROLES.filter((r) => r.value !== profile.role);

    Alert.alert(
      'Change role',
      `${profile.displayName} — Current role: ${ROLE_LABELS[profile.role]}`,
      [
        ...options.map((opt) => ({
          text: opt.label,
          onPress: async () => {
            try {
              await updateDoc(
                doc(db, 'teams', activeTeamId!, 'members', userId),
                { role: opt.value }
              );
              setProfile((prev) => (prev ? { ...prev, role: opt.value } : prev));
            } catch (err) {
              Alert.alert('Error', 'Failed to change role.');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const handleRemoveMember = () => {
    if (!profile || !isAdmin) return;

    Alert.alert(
      'Remove member',
      `Are you sure you want to remove ${profile.displayName} from the team?`,
      [
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(
                doc(db, 'teams', activeTeamId!, 'members', userId)
              );
              // Also remove teamId from user's teamIds
              const userRef = doc(db, 'users', userId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const teamIds: string[] = userSnap.data().teamIds || [];
                await updateDoc(userRef, {
                  teamIds: teamIds.filter((t) => t !== activeTeamId),
                });
              }
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', 'Failed to remove member.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderField = (icon: string, label: string, value: string) => {
    const isEmpty = !value;
    return (
      <View style={styles.fieldRow}>
        <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, isEmpty && styles.fieldValueEmpty]}>
          {isEmpty ? '-' : value}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Member not found.</Text>
      </View>
    );
  }

  const roleColor = ROLE_COLORS[profile.role];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + name + role */}
        <View style={styles.avatarSection}>
          {userGlobal.photoURL ? (
            <Image source={{ uri: userGlobal.photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, { borderColor: roleColor }]}>
              <Text style={styles.avatarText}>
                {profile.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.nameText}>{profile.displayName}</Text>
          {userGlobal.email ? (
            <Text style={styles.emailText}>{userGlobal.email}</Text>
          ) : null}
          <View style={[styles.rolePill, { borderColor: roleColor }]}>
            <Ionicons name={ROLE_ICONS[profile.role] as any} size={14} color={roleColor} />
            <Text style={[styles.roleText, { color: roleColor }]}>
              {ROLE_LABELS[profile.role]}
            </Text>
          </View>
        </View>

        {/* Profile fields (read-only) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Team info</Text>
          {renderField('shirt-outline', 'Jersey number', profile.jerseyNumber ? `#${profile.jerseyNumber}` : '')}
          {renderField('body-outline', 'Position', profile.position.length > 0 ? profile.position.join(', ') : '')}
          {renderField('resize-outline', 'Height', profile.height ? `${profile.height} cm` : '')}
          {renderField('barbell-outline', 'Weight', profile.weight ? `${profile.weight} kg` : '')}
          {renderField('call-outline', 'Phone', profile.phone)}
          {renderField('shirt-outline', 'Jersey size', profile.jerseySize)}
          {renderField('card-outline', 'ID number', profile.idNumber)}
          {renderField('medical-outline', 'Medical clearance', profile.medicalExpiry || '')}
        </View>

        {/* License card */}
        {profile.licenseCardURL && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Player license card</Text>
            <TouchableOpacity onPress={() => setShowLicenseModal(true)} activeOpacity={0.8}>
              <Image source={{ uri: profile.licenseCardURL }} style={styles.licenseThumb} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        )}

        <Modal visible={showLicenseModal} transparent animationType="fade">
          <Pressable style={styles.licenseOverlay} onPress={() => setShowLicenseModal(false)}>
            {profile.licenseCardURL && (
              <Image source={{ uri: profile.licenseCardURL }} style={styles.licenseFull} resizeMode="contain" />
            )}
          </Pressable>
        </Modal>

        {/* Admin actions */}
        {isAdmin && (
          <View style={styles.actionsSection}>
            <TouchableOpacity style={[styles.actionButton, styles.actionDanger]} onPress={handleChangeRole}>
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.error} />
              <Text style={[styles.actionText, styles.actionTextDanger]}>Change role</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRemoveMember}
            >
              <Ionicons name="person-remove-outline" size={20} color={colors.accent} />
              <Text style={styles.actionText}>Remove from team</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardLight,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  emailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    width: 110,
  },
  fieldValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  fieldValueEmpty: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  licenseThumb: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: spacing.sm,
    backgroundColor: colors.cardLight,
  },
  licenseOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  licenseFull: {
    width: '100%',
    height: '80%',
  },
  actionsSection: {
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionDanger: {
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
  actionTextDanger: {
    color: colors.error,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
