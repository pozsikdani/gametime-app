import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTeam } from '../contexts/TeamContext';
import { colors, spacing } from '../constants/theme';

const APP_VERSION = Constants.expoConfig?.version || '?';

export default function TeamHeader() {
  const { activeTeamId, activeTeam, teams, switchTeam } = useTeam();
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const hasMultipleTeams = teams.length > 1;

  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
        {hasMultipleTeams ? (
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.teamName}>{activeTeam?.name || 'Team'}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.teamNameSingle}>{activeTeam?.name || 'Team'}</Text>
        )}
        <Text style={styles.versionText}>v{APP_VERSION}</Text>
      </View>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Switch team</Text>
            {teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.item,
                  team.id === activeTeamId && styles.itemActive,
                ]}
                onPress={() => {
                  switchTeam(team.id);
                  setVisible(false);
                }}
              >
                <View style={styles.itemLeft}>
                  <View style={[
                    styles.dot,
                    team.id === activeTeamId && styles.dotActive,
                  ]} />
                  <Text style={[
                    styles.itemText,
                    team.id === activeTeamId && styles.itemTextActive,
                  ]}>
                    {team.name}
                  </Text>
                </View>
                {team.id === activeTeamId && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionText: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.sm + 2,
    fontSize: 10,
    color: colors.textSecondary,
    opacity: 0.5,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  teamNameSingle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dropdown: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.xs,
  },
  itemActive: {
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textSecondary,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  itemText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  itemTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
});
