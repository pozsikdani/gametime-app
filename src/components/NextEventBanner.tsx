import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { CalendarEvent, Rsvp, RsvpStatus } from '../types';
import { colors, spacing } from '../constants/theme';
import { useTeam } from '../contexts/TeamContext';

type Props = {
  onPress: (eventId: string) => void;
};

export default function NextEventBanner({ onPress }: Props) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(null);
  const [rsvpCounts, setRsvpCounts] = useState({ yes: 0, no: 0, maybe: 0 });
  const [collapsed, setCollapsed] = useState(false);
  const currentUser = auth.currentUser;
  const { activeTeamId } = useTeam();

  // Fetch next upcoming event (date > now)
  useEffect(() => {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'teams', activeTeamId!, 'events'),
      where('date', '>', now),
      orderBy('date', 'asc'),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setEvent(null);
      } else {
        const d = snapshot.docs[0];
        setEvent({ id: d.id, ...d.data() } as CalendarEvent);
      }
    });

    return unsub;
  }, [activeTeamId]);

  // Fetch RSVPs for this event
  useEffect(() => {
    if (!event) return;

    const q = query(collection(db, 'teams', activeTeamId!, 'events', event.id, 'rsvps'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: Rsvp[] = snapshot.docs.map((d) => ({
        ...d.data(),
        userId: d.id,
      })) as Rsvp[];

      const mine = items.find((r) => r.userId === currentUser?.uid);
      setMyRsvp(mine?.status || null);

      setRsvpCounts({
        yes: items.filter((r) => r.status === 'yes').length,
        no: items.filter((r) => r.status === 'no').length,
        maybe: items.filter((r) => r.status === 'maybe').length,
      });
    });

    return unsub;
  }, [event?.id, activeTeamId]);

  const handleRsvp = async (status: RsvpStatus) => {
    if (!currentUser || !event) return;
    const rsvpRef = doc(db, 'teams', activeTeamId!, 'events', event.id, 'rsvps', currentUser.uid);
    await setDoc(rsvpRef, {
      userName: currentUser.displayName || 'Ismeretlen',
      status,
      updatedAt: serverTimestamp(),
    });
  };

  if (!event) return null;

  const isMatch = event.type === 'match';
  const d = event.date.toDate();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${months[d.getMonth()]} ${d.getDate()}. ${days[d.getDay()]} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  // Time until event
  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  let countdown = '';
  if (diffDays > 0) {
    countdown = `${diffDays} days ${diffHours} hours left`;
  } else if (diffHours > 0) {
    countdown = `${diffHours} hours left`;
  } else {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    countdown = `${diffMins} min left`;
  }

  const rsvpButtons = isMatch
    ? [
        { status: 'yes' as RsvpStatus, label: 'Yes', icon: 'checkmark-circle' as const, color: colors.success },
        { status: 'no' as RsvpStatus, label: 'No', icon: 'close-circle' as const, color: colors.error },
      ]
    : [
        { status: 'yes' as RsvpStatus, label: 'Yes', icon: 'checkmark-circle' as const, color: colors.success },
        { status: 'maybe' as RsvpStatus, label: 'Maybe', icon: 'help-circle' as const, color: '#fdcb6e' },
        { status: 'no' as RsvpStatus, label: 'No', icon: 'close-circle' as const, color: colors.error },
      ];

  if (collapsed) {
    return (
      <TouchableOpacity
        style={styles.bannerCollapsed}
        onPress={() => setCollapsed(false)}
        activeOpacity={0.8}
      >
        <View style={[styles.typeBadge, isMatch ? styles.matchBadge : styles.trainingBadge]}>
          <Ionicons
            name={isMatch ? 'basketball-outline' : 'fitness-outline'}
            size={12}
            color={colors.text}
          />
        </View>
        <Text style={styles.collapsedTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.collapsedCountdown}>{countdown}</Text>
        {myRsvp && (
          <Ionicons
            name={myRsvp === 'yes' ? 'checkmark-circle' : myRsvp === 'no' ? 'close-circle' : 'help-circle'}
            size={16}
            color={myRsvp === 'yes' ? colors.success : myRsvp === 'no' ? colors.error : '#fdcb6e'}
          />
        )}
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.banner}>
      {/* Top row: type badge + title + countdown + hide button */}
      <View style={styles.topRow}>
        <View style={[styles.typeBadge, isMatch ? styles.matchBadge : styles.trainingBadge]}>
          <Ionicons
            name={isMatch ? 'basketball-outline' : 'fitness-outline'}
            size={14}
            color={colors.text}
          />
          <Text style={styles.typeText}>{isMatch ? 'Match' : 'Training'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.countdown}>{countdown}</Text>
          <TouchableOpacity onPress={() => setCollapsed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={() => onPress(event.id)} activeOpacity={0.8}>
        {/* Event title */}
        <Text style={styles.title} numberOfLines={1}>{event.title}</Text>

        {/* Date + location */}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.detailText}>{dateStr}</Text>
          <Ionicons name="location-outline" size={13} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
          <Text style={styles.detailText} numberOfLines={1}>{event.location}</Text>
        </View>
      </TouchableOpacity>

      {/* RSVP buttons */}
      <View style={styles.rsvpRow}>
        {rsvpButtons.map((btn) => {
          const isActive = myRsvp === btn.status;
          return (
            <TouchableOpacity
              key={btn.status}
              style={[
                styles.rsvpButton,
                { borderColor: btn.color },
                isActive && { backgroundColor: btn.color },
              ]}
              onPress={() => handleRsvp(btn.status)}
            >
              <Ionicons
                name={btn.icon}
                size={16}
                color={isActive ? colors.text : btn.color}
              />
              <Text style={[
                styles.rsvpText,
                isActive && { color: colors.text },
                !isActive && { color: btn.color },
              ]}>
                {btn.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Count summary */}
        <View style={styles.countChip}>
          <Text style={[styles.countText, { color: colors.success }]}>{rsvpCounts.yes}</Text>
          <Text style={styles.countSep}>/</Text>
          <Text style={[styles.countText, { color: colors.error }]}>{rsvpCounts.no}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: 12,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  bannerCollapsed: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  collapsedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  collapsedCountdown: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchBadge: {
    backgroundColor: colors.accent,
  },
  trainingBadge: {
    backgroundColor: colors.success,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  countdown: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  detailText: {
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  rsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  rsvpText: {
    fontSize: 12,
    fontWeight: '600',
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 2,
  },
  countText: {
    fontSize: 14,
    fontWeight: '700',
  },
  countSep: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
