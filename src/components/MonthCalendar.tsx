import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { CalendarEvent } from '../types';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  events: CalendarEvent[];
  currentMonth: Date;
  onChangeMonth: (date: Date) => void;
  onDayPress: (date: Date) => void;
  onEventPress: (eventId: string) => void;
  selectedDate: string | null;
};

const DAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getEventDateKey(e: CalendarEvent): string {
  try {
    const d = e.date.toDate();
    return toDateKey(d);
  } catch {
    return '';
  }
}

function formatTime(timestamp: Timestamp): string {
  const d = timestamp.toDate();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: (Date | null)[] = [];

  // Padding before
  for (let i = 0; i < startDow; i++) {
    days.push(null);
  }

  // Actual days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Padding after to fill last row
  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export default function MonthCalendar({ events, currentMonth, onChangeMonth, onDayPress, onEventPress, selectedDate }: Props) {
  const { colors } = useTheme();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days = getMonthDays(year, month);

  const today = new Date();
  const todayKey = toDateKey(today);

  // Group events by date
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  events.forEach((e) => {
    const key = getEventDateKey(e);
    if (key) {
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push(e);
    }
  });

  const prevMonth = () => {
    onChangeMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    onChangeMonth(new Date(year, month + 1, 1));
  };

  // Split days into weeks
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    monthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    arrow: {
      padding: spacing.xs,
    },
    monthTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    dayNamesRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    dayNameCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
    },
    dayNameText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    weekRow: {
      flexDirection: 'row',
    },
    dayCell: {
      flex: 1,
      minHeight: 80,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 3,
    },
    dayCellActive: {
      backgroundColor: colors.card,
    },
    todayCell: {
      borderWidth: 2,
      borderColor: colors.accent,
    },
    selectedCell: {
      backgroundColor: 'rgba(196, 30, 58, 0.1)',
    },
    pastCell: {
      backgroundColor: 'rgba(21, 21, 24, 0.5)',
    },
    dayNumber: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    todayNumber: {
      color: colors.accent,
      fontWeight: '800',
    },
    pastText: {
      opacity: 0.4,
    },
    pastPill: {
      opacity: 0.4,
    },
    eventPill: {
      borderRadius: 4,
      paddingHorizontal: 3,
      paddingVertical: 1,
      marginBottom: 2,
    },
    matchPill: {
      backgroundColor: 'rgba(196, 30, 58, 0.25)',
      borderLeftWidth: 2,
      borderLeftColor: colors.accent,
    },
    trainingPill: {
      backgroundColor: 'rgba(0, 184, 148, 0.2)',
      borderLeftWidth: 2,
      borderLeftColor: '#00b894',
    },
    eventPillTitle: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.text,
    },
    eventPillTime: {
      fontSize: 9,
      color: colors.textSecondary,
    },
    moreText: {
      fontSize: 9,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Month header */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.arrow}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Day names */}
      <View style={styles.dayNamesRow}>
        {DAY_NAMES.map((d, i) => (
          <View key={i} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) {
              return <View key={di} style={styles.dayCell} />;
            }

            const dateKey = toDateKey(day);
            const isToday = dateKey === todayKey;
            const isPast = day.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const isSelected = dateKey === selectedDate;
            const dayEvents = eventsByDate[dateKey] || [];

            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.dayCell,
                  styles.dayCellActive,
                  isToday && styles.todayCell,
                  isSelected && styles.selectedCell,
                  isPast && styles.pastCell,
                ]}
                onPress={() => onDayPress(day)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayNumber,
                  isToday && styles.todayNumber,
                  isPast && styles.pastText,
                ]}>
                  {day.getDate()}
                </Text>

                {dayEvents.slice(0, 2).map((ev) => (
                  <TouchableOpacity
                    key={ev.id}
                    style={[
                      styles.eventPill,
                      ev.type === 'match' ? styles.matchPill : styles.trainingPill,
                      isPast && styles.pastPill,
                    ]}
                    onPress={() => onEventPress(ev.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.eventPillTitle, isPast && styles.pastText]} numberOfLines={1}>
                      {ev.type === 'match' && ev.opponent
                        ? `${ev.isHome ? 'vs' : '@'}${ev.opponent}`
                        : ev.title}
                    </Text>
                    <Text style={[styles.eventPillTime, isPast && styles.pastText]}>
                      {formatTime(ev.date)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {dayEvents.length > 2 && (
                  <Text style={[styles.moreText, isPast && styles.pastText]}>
                    +{dayEvents.length - 2}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
