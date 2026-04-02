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
  Timestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseConfig';
import { CalendarEvent } from '../types';
import { colors, spacing } from '../constants/theme';
import { useAdmin } from '../hooks/useAdmin';
import { syncMkoszMatches } from '../utils/syncMkoszMatches';
import MonthCalendar from '../components/MonthCalendar';
import { useTeam } from '../contexts/TeamContext';

type Props = {
  navigation: any;
};

type FilterType = 'all' | 'match' | 'training';
type ViewMode = 'list' | 'calendar';

export default function CalendarScreen({ navigation }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isAdmin = useAdmin();
  const { activeTeamId } = useTeam();

  // Auto-sync MKOSZ matches on first load
  useEffect(() => {
    if (activeTeamId) syncMkoszMatches(activeTeamId).catch(console.error);
  }, [activeTeamId]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const added = await syncMkoszMatches(activeTeamId!);
      alert(added > 0 ? `${added} új meccs importálva!` : 'Nincs új meccs.');
    } catch (e) {
      alert('Hiba a szinkronizálás során');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'teams', activeTeamId!, 'events'),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: CalendarEvent[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CalendarEvent[];
      setEvents(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [activeTeamId]);

  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true;
    return e.type === filter;
  });

  // Time boundaries for sections
  const now = new Date();
  const nowMs = now.getTime();

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfWeek.getDate() + 7);

  const getEventTime = (e: CalendarEvent) => {
    try { return e.date.toDate().getTime(); } catch { return 0; }
  };

  const thisWeek = filteredEvents.filter((e) => {
    const t = getEventTime(e);
    return t >= nowMs && t <= endOfWeek.getTime();
  });

  const nextWeek = filteredEvents.filter((e) => {
    const t = getEventTime(e);
    return t > endOfWeek.getTime() && t <= endOfNextWeek.getTime();
  });

  const later = filteredEvents.filter((e) => {
    const t = getEventTime(e);
    return t > endOfNextWeek.getTime();
  });

  const past = filteredEvents.filter((e) => {
    return getEventTime(e) < nowMs;
  }).reverse();

  const formatDate = (timestamp: Timestamp) => {
    const d = timestamp.toDate();
    const days = ['Vas', 'Hét', 'Kedd', 'Sze', 'Csüt', 'Pén', 'Szo'];
    const months = ['jan', 'feb', 'már', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
    return `${months[d.getMonth()]} ${d.getDate()}. ${days[d.getDay()]} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const isUpcoming = (event: CalendarEvent) => {
    try { return event.date.toDate().getTime() >= nowMs; } catch { return false; }
  };

  const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const getEventsForDate = (dateStr: string) => {
    return filteredEvents.filter((e) => {
      try {
        const d = e.date.toDate();
        return toDateKey(d) === dateStr;
      } catch { return false; }
    });
  };

  const renderEvent = ({ item }: { item: CalendarEvent }) => {
    const isFuture = isUpcoming(item);
    const isMatch = item.type === 'match';

    return (
      <TouchableOpacity
        style={[styles.eventCard, !isFuture && styles.eventCardPast]}
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      >
        <View style={styles.eventLeft}>
          <View style={[
            styles.typeBadge,
            isMatch ? styles.matchBadge : styles.trainingBadge,
          ]}>
            <Ionicons
              name={isMatch ? 'basketball-outline' : 'fitness-outline'}
              size={16}
              color={colors.text}
            />
          </View>
        </View>

        <View style={styles.eventContent}>
          <Text style={[styles.eventTitle, !isFuture && styles.textPast]}>
            {item.title}
          </Text>
          <Text style={styles.eventDate}>{formatDate(item.date)}</Text>
          <View style={styles.eventMeta}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.eventLocation}>{item.location}</Text>
          </View>
          {item.score && (
            <Text style={styles.eventScore}>{item.score}</Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const selectedDayEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Naptár</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          {/* View mode toggle */}
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            style={styles.addButton}
          >
            <Ionicons
              name={viewMode === 'list' ? 'calendar' : 'list'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              onPress={handleSync}
              style={styles.addButton}
              disabled={syncing}
            >
              <Ionicons
                name="sync-outline"
                size={24}
                color={syncing ? colors.textSecondary : colors.accent}
              />
            </TouchableOpacity>
          )}
          {isAdmin && (
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateEvent')}
              style={styles.addButton}
            >
              <Ionicons name="add-circle" size={28} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'match', 'training'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Mind' : f === 'match' ? 'Meccsek' : 'Edzések'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'calendar' ? (
        /* ===== CALENDAR VIEW ===== */
        <FlatList
          data={selectedDayEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <MonthCalendar
              events={filteredEvents}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              onDayPress={(date) => setSelectedDate(toDateKey(date))}
              onEventPress={(eventId) => navigation.navigate('EventDetail', { eventId })}
              selectedDate={selectedDate}
            />
          }
        />
      ) : (
        /* ===== LIST VIEW ===== */
        <FlatList
          data={[
            ...(thisWeek.length > 0 ? [{ id: '__header_thisweek', _isHeader: true, _title: `E heti események (${thisWeek.length})` } as any] : []),
            ...thisWeek,
            ...(nextWeek.length > 0 ? [{ id: '__header_nextweek', _isHeader: true, _title: `Jövő heti események (${nextWeek.length})` } as any] : []),
            ...nextWeek,
            ...(later.length > 0 ? [{ id: '__header_later', _isHeader: true, _title: `További események (${later.length})` } as any] : []),
            ...later,
            ...(past.length > 0 ? [{ id: '__header_past', _isHeader: true, _title: `Korábbi események (${past.length})` } as any] : []),
            ...past,
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
            return renderEvent({ item });
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nincs esemény</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  filterTabActive: {
    backgroundColor: colors.accent,
  },
  filterText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.text,
    fontWeight: '600',
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
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
  },
  eventCardPast: {
    opacity: 0.5,
  },
  eventLeft: {
    marginRight: spacing.md,
  },
  typeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchBadge: {
    backgroundColor: colors.accent,
  },
  trainingBadge: {
    backgroundColor: '#00b894',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  textPast: {
    color: colors.textSecondary,
  },
  eventDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventLocation: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  eventScore: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
