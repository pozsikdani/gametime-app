import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTeam } from '../contexts/TeamContext';
import { Team } from '../types';
import { colors, spacing } from '../constants/theme';

export default function TeamPickerScreen() {
  const { teams, activeTeamId, switchTeam } = useTeam();

  const renderTeam = ({ item }: { item: Team }) => {
    const isActive = item.id === activeTeamId;
    return (
      <TouchableOpacity
        style={[styles.teamCard, isActive && styles.teamCardActive]}
        onPress={() => switchTeam(item.id)}
      >
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.teamLogo} />
        ) : (
          <View style={styles.teamLogoFallback}>
            <Text style={styles.teamLogoText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.teamInfo}>
          <Text style={styles.teamName}>{item.name}</Text>
          <Text style={styles.teamSport}>{item.sport}</Text>
        </View>
        {isActive && (
          <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Csapataim</Text>
      </View>
      <FlatList
        data={teams}
        keyExtractor={(item) => item.id}
        renderItem={renderTeam}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  list: {
    padding: spacing.md,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamCardActive: {
    borderColor: colors.accent,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  teamLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamLogoText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  teamInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  teamSport: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
