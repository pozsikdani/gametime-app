import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  onSnapshot,
  setDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebaseConfig';
import { CalendarEvent, Rsvp, RsvpStatus } from '../types';
import { colors, spacing } from '../constants/theme';
import { useAdmin } from '../hooks/useAdmin';
import { useTeam } from '../contexts/TeamContext';

type Props = {
  route: any;
  navigation: any;
};

export default function EventDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDateStr, setEditDateStr] = useState('');
  const [editTimeStr, setEditTimeStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [squadSelection, setSquadSelection] = useState<Set<string>>(new Set());
  const [selectingSquad, setSelectingSquad] = useState(false);
  const currentUser = auth.currentUser;
  const isAdmin = useAdmin();
  const { activeTeamId, membership } = useTeam();
  const isGuest = membership?.role === 'guest';

  useEffect(() => {
    const unsubEvent = onSnapshot(doc(db, 'teams', activeTeamId!, 'events', eventId), (docSnap) => {
      if (docSnap.exists()) {
        setEvent({ id: docSnap.id, ...docSnap.data() } as CalendarEvent);
      }
      setLoading(false);
    });
    return unsubEvent;
  }, [eventId]);

  useEffect(() => {
    const q = query(collection(db, 'teams', activeTeamId!, 'events', eventId, 'rsvps'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Rsvp[] = snapshot.docs.map((d) => ({
        ...d.data(),
        userId: d.id,
      })) as Rsvp[];
      setRsvps(items);

      const mine = items.find((r) => r.userId === currentUser?.uid);
      setMyRsvp(mine?.status || null);
    });
    return unsubscribe;
  }, [eventId]);

  const handleRsvp = async (status: RsvpStatus) => {
    if (!currentUser) return;

    const rsvpRef = doc(db, 'teams', activeTeamId!, 'events', eventId, 'rsvps', currentUser.uid);
    await setDoc(rsvpRef, {
      userName: currentUser.displayName || 'Ismeretlen',
      status,
      updatedAt: serverTimestamp(),
    });
  };

  const startEdit = () => {
    if (!event) return;
    const d = event.date.toDate();
    setEditTitle(event.title);
    setEditLocation(event.location);
    setEditDateStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setEditTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editLocation.trim() || !editDateStr.trim()) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    const [year, month, day] = editDateStr.split('-').map(Number);
    const [hour, minute] = editTimeStr.split(':').map(Number);
    if (!year || !month || !day || isNaN(hour) || isNaN(minute)) {
      Alert.alert('Error', 'Invalid date or time format');
      return;
    }

    setSaving(true);
    try {
      const newDate = new Date(year, month - 1, day, hour, minute);
      await updateDoc(doc(db, 'teams', activeTeamId!, 'events', eventId), {
        title: editTitle.trim(),
        location: editLocation.trim(),
        date: Timestamp.fromDate(newDate),
      });

      // Chat log
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateFormatted = `${months[newDate.getMonth()]} ${newDate.getDate()}. ${days[newDate.getDay()]} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const typeLabel = event?.type === 'match' ? 'Match' : 'Training';
      const chatText = `${typeLabel} updated: "${editTitle.trim()}"\n\n  ${dateFormatted}\n  ${editLocation.trim()}`;

      await addDoc(collection(db, 'teams', activeTeamId!, 'messages'), {
        text: chatText,
        senderId: 'system',
        senderName: 'Calendar',
        createdAt: serverTimestamp(),
        type: 'system',
      });

      setEditing(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'teams', activeTeamId!, 'events', eventId));
          navigation.goBack();
        },
      },
    ]);
  };

  const startSquadSelect = () => {
    const existing = new Set(event?.squad || []);
    setSquadSelection(existing);
    setSelectingSquad(true);
  };

  const toggleSquadMember = (userId: string) => {
    setSquadSelection((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const saveSquad = async () => {
    const selected = Array.from(squadSelection);
    if (selected.length < 5 || selected.length > 12) {
      Alert.alert('Error', `Squad must be 5-12 players (current: ${selected.length})`);
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'teams', activeTeamId!, 'events', eventId), { squad: selected });
      setSelectingSquad(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save squad');
    } finally {
      setSaving(false);
    }
  };

  const clearSquad = () => {
    Alert.alert('Clear squad', 'Are you sure you want to clear the squad?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'teams', activeTeamId!, 'events', eventId), { squad: [] });
        },
      },
    ]);
  };

  const formatFullDate = (timestamp: Timestamp) => {
    const d = timestamp.toDate();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${d.getFullYear()}. ${months[d.getMonth()]} ${d.getDate()}. ${days[d.getDay()]}\n${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading || !event) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isMatch = event.type === 'match';
  const isPast = event.date.toDate() < new Date();

  const availablePlayers = rsvps.filter((r) => r.status === 'yes');
  const unavailablePlayers = rsvps.filter((r) => r.status === 'no');
  const hasSquad = event.squad && event.squad.length > 0;
  const isInSquad = currentUser ? event.squad?.includes(currentUser.uid) : false;

  // Training counts
  const yesCount = rsvps.filter((r) => r.status === 'yes').length;
  const noCount = rsvps.filter((r) => r.status === 'no').length;
  const maybeCount = rsvps.filter((r) => r.status === 'maybe').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={[styles.typeBanner, isMatch ? styles.matchBanner : styles.trainingBanner]}>
        <Ionicons
          name={isMatch ? 'basketball-outline' : 'fitness-outline'}
          size={24}
          color={colors.text}
        />
        <Text style={styles.typeLabel}>
          {isMatch ? 'Match' : 'Training'}
        </Text>
      </View>

      {editing ? (
        <>
          <Text style={styles.editLabel}>Name</Text>
          <TextInput
            style={styles.editInput}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.editLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.editInput}
            value={editDateStr}
            onChangeText={setEditDateStr}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.editLabel}>Time (HH:MM)</Text>
          <TextInput
            style={styles.editInput}
            value={editTimeStr}
            onChangeText={setEditTimeStr}
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={styles.editLabel}>Location</Text>
          <TextInput
            style={styles.editInput}
            value={editLocation}
            onChangeText={setEditLocation}
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.editSaveButton, saving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={saving}
            >
              <Text style={styles.editSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editCancelButton}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.editCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.title, { flex: 1 }]}>{event.title}</Text>
            {isAdmin && (
              <TouchableOpacity onPress={startEdit} style={{ padding: spacing.xs }}>
                <Ionicons name="pencil-outline" size={22} color={colors.accent} />
              </TouchableOpacity>
            )}
          </View>

          {event.score && (
            <Text style={styles.score}>{event.score}</Text>
          )}

          {/* Details */}
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.detailText}>{formatFullDate(event.date)}</Text>
            </View>
            {isMatch ? (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => {
                  const address = encodeURIComponent(event.location);
                  const url = Platform.select({
                    ios: `maps:0,0?q=${address}`,
                    android: `geo:0,0?q=${address}`,
                  }) || `https://www.google.com/maps/search/?api=1&query=${address}`;
                  Linking.openURL(url);
                }}
              >
                <Ionicons name="location-outline" size={18} color={colors.accent} />
                <Text style={[styles.detailText, styles.detailLink]}>{event.location}</Text>
                <Ionicons name="open-outline" size={14} color={colors.accent} />
              </TouchableOpacity>
            ) : (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.detailText}>{event.location}</Text>
              </View>
            )}
            {isMatch && event.opponent && (
              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  vs {event.opponent} ({event.isHome ? 'Home' : 'Away'})
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* ===== MATCH: Availability + Squad ===== */}
      {isMatch && !isPast && !editing && !isGuest && (
        <>
          {/* Availability buttons */}
          <View style={styles.rsvpSection}>
            <Text style={styles.sectionTitle}>Are you available?</Text>
            <View style={styles.rsvpButtons}>
              <TouchableOpacity
                style={[styles.rsvpButton, styles.rsvpYes, myRsvp === 'yes' && styles.rsvpActive]}
                onPress={() => handleRsvp('yes')}
              >
                <Ionicons name="checkmark-circle" size={20} color={myRsvp === 'yes' ? colors.text : '#00b894'} />
                <Text style={[styles.rsvpText, myRsvp === 'yes' && styles.rsvpTextActive]}>Yes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rsvpButton, styles.rsvpNo, myRsvp === 'no' && styles.rsvpNoActive]}
                onPress={() => handleRsvp('no')}
              >
                <Ionicons name="close-circle" size={20} color={myRsvp === 'no' ? colors.text : colors.error} />
                <Text style={[styles.rsvpText, myRsvp === 'no' && styles.rsvpTextActive]}>No</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Squad announced banner */}
          {hasSquad && !selectingSquad && (
            <View style={styles.squadBanner}>
              <View style={styles.squadHeader}>
                <Text style={styles.sectionTitle}>Squad ({event.squad!.length})</Text>
                {isAdmin && (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TouchableOpacity onPress={startSquadSelect}>
                      <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearSquad}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {isInSquad && (
                <View style={styles.inSquadBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#00b894" />
                  <Text style={styles.inSquadText}>You're in the squad!</Text>
                </View>
              )}
              {event.squad!.map((uid) => {
                const player = rsvps.find((r) => r.userId === uid);
                return (
                  <View key={uid} style={styles.squadMemberRow}>
                    <Ionicons name="person" size={14} color={colors.accent} />
                    <Text style={styles.squadMemberName}>
                      {player?.userName || 'Ismeretlen'}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Admin: squad selection mode */}
          {isAdmin && selectingSquad && (
            <View style={styles.squadSelectSection}>
              <Text style={styles.sectionTitle}>
                Select squad ({squadSelection.size})
              </Text>
              {availablePlayers.length === 0 && (
                <Text style={styles.emptyText}>Nobody has indicated availability yet.</Text>
              )}
              {availablePlayers.map((player) => {
                const selected = squadSelection.has(player.userId);
                return (
                  <TouchableOpacity
                    key={player.userId}
                    style={[styles.squadSelectRow, selected && styles.squadSelectRowActive]}
                    onPress={() => toggleSquadMember(player.userId)}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? '#00b894' : colors.textSecondary}
                    />
                    <Text style={[styles.squadSelectName, selected && { color: colors.text }]}>
                      {player.userName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.editSaveButton, saving && { opacity: 0.6 }]}
                  onPress={saveSquad}
                  disabled={saving}
                >
                  <Text style={styles.editSaveText}>
                    {saving ? 'Saving...' : `Announce squad (${squadSelection.size})`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editCancelButton}
                  onPress={() => setSelectingSquad(false)}
                >
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Admin: open squad selection button */}
          {isAdmin && !selectingSquad && !hasSquad && availablePlayers.length > 0 && (
            <TouchableOpacity style={styles.announceSquadButton} onPress={startSquadSelect}>
              <Ionicons name="people" size={18} color={colors.text} />
              <Text style={styles.announceSquadText}>Announce squad</Text>
            </TouchableOpacity>
          )}

          {/* Availability summary */}
          <View style={styles.rsvpSummary}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.rsvpCounts}>
              <View style={styles.countBadge}>
                <Text style={[styles.countNumber, { color: '#00b894' }]}>{availablePlayers.length}</Text>
                <Text style={styles.countLabel}>Available</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={[styles.countNumber, { color: colors.error }]}>{unavailablePlayers.length}</Text>
                <Text style={styles.countLabel}>Not available</Text>
              </View>
            </View>

            {availablePlayers.length > 0 && (
              <View style={styles.nameSection}>
                <Text style={[styles.nameLabel, { color: '#00b894' }]}>Available:</Text>
                <Text style={styles.nameList}>
                  {availablePlayers.map((r) => r.userName).join(', ')}
                </Text>
              </View>
            )}
            {unavailablePlayers.length > 0 && (
              <View style={styles.nameSection}>
                <Text style={[styles.nameLabel, { color: colors.error }]}>Not available:</Text>
                <Text style={styles.nameList}>
                  {unavailablePlayers.map((r) => r.userName).join(', ')}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* ===== MATCH PAST: show squad if existed ===== */}
      {isMatch && isPast && hasSquad && (
        <View style={styles.squadBanner}>
          <Text style={styles.sectionTitle}>Squad ({event.squad!.length})</Text>
          {event.squad!.map((uid) => {
            const player = rsvps.find((r) => r.userId === uid);
            return (
              <View key={uid} style={styles.squadMemberRow}>
                <Ionicons name="person" size={14} color={colors.accent} />
                <Text style={styles.squadMemberName}>
                  {player?.userName || 'Ismeretlen'}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ===== TRAINING: original 3-way RSVP ===== */}
      {!isMatch && !isPast && !editing && (
        <View style={styles.rsvpSection}>
          <Text style={styles.sectionTitle}>Are you coming?</Text>
          <View style={styles.rsvpButtons}>
            <TouchableOpacity
              style={[styles.rsvpButton, styles.rsvpYes, myRsvp === 'yes' && styles.rsvpActive]}
              onPress={() => handleRsvp('yes')}
            >
              <Ionicons name="checkmark-circle" size={20} color={myRsvp === 'yes' ? colors.text : '#00b894'} />
              <Text style={[styles.rsvpText, myRsvp === 'yes' && styles.rsvpTextActive]}>Going</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rsvpButton, styles.rsvpMaybe, myRsvp === 'maybe' && styles.rsvpMaybeActive]}
              onPress={() => handleRsvp('maybe')}
            >
              <Ionicons name="help-circle" size={20} color={myRsvp === 'maybe' ? colors.text : '#fdcb6e'} />
              <Text style={[styles.rsvpText, myRsvp === 'maybe' && styles.rsvpTextActive]}>Maybe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rsvpButton, styles.rsvpNo, myRsvp === 'no' && styles.rsvpNoActive]}
              onPress={() => handleRsvp('no')}
            >
              <Ionicons name="close-circle" size={20} color={myRsvp === 'no' ? colors.text : colors.error} />
              <Text style={[styles.rsvpText, myRsvp === 'no' && styles.rsvpTextActive]}>Not going</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Training RSVP summary */}
      {!isMatch && !editing && (
        <View style={styles.rsvpSummary}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <View style={styles.rsvpCounts}>
            <View style={styles.countBadge}>
              <Text style={[styles.countNumber, { color: '#00b894' }]}>{yesCount}</Text>
              <Text style={styles.countLabel}>Going</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={[styles.countNumber, { color: '#fdcb6e' }]}>{maybeCount}</Text>
              <Text style={styles.countLabel}>Maybe</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={[styles.countNumber, { color: colors.error }]}>{noCount}</Text>
              <Text style={styles.countLabel}>Not going</Text>
            </View>
          </View>

          {rsvps.filter((r) => r.status === 'yes').length > 0 && (
            <View style={styles.nameSection}>
              <Text style={[styles.nameLabel, { color: '#00b894' }]}>Going:</Text>
              <Text style={styles.nameList}>
                {rsvps.filter((r) => r.status === 'yes').map((r) => r.userName).join(', ')}
              </Text>
            </View>
          )}
          {rsvps.filter((r) => r.status === 'maybe').length > 0 && (
            <View style={styles.nameSection}>
              <Text style={[styles.nameLabel, { color: '#fdcb6e' }]}>Maybe:</Text>
              <Text style={styles.nameList}>
                {rsvps.filter((r) => r.status === 'maybe').map((r) => r.userName).join(', ')}
              </Text>
            </View>
          )}
          {rsvps.filter((r) => r.status === 'no').length > 0 && (
            <View style={styles.nameSection}>
              <Text style={[styles.nameLabel, { color: colors.error }]}>Not going:</Text>
              <Text style={styles.nameList}>
                {rsvps.filter((r) => r.status === 'no').map((r) => r.userName).join(', ')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Admin delete */}
      {isAdmin && !editing && !selectingSquad && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={styles.deleteText}>Delete event</Text>
        </TouchableOpacity>
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
  typeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  matchBanner: {
    backgroundColor: colors.accent,
  },
  trainingBanner: {
    backgroundColor: '#00b894',
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  score: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  detailLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  rsvpSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  rsvpYes: {
    borderColor: '#00b894',
    backgroundColor: 'transparent',
  },
  rsvpActive: {
    backgroundColor: '#00b894',
    borderColor: '#00b894',
  },
  rsvpMaybe: {
    borderColor: '#fdcb6e',
    backgroundColor: 'transparent',
  },
  rsvpMaybeActive: {
    backgroundColor: '#fdcb6e',
    borderColor: '#fdcb6e',
  },
  rsvpNo: {
    borderColor: colors.error,
    backgroundColor: 'transparent',
  },
  rsvpNoActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  rsvpText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  rsvpTextActive: {
    color: colors.text,
  },
  rsvpSummary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  rsvpCounts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  countBadge: {
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  countLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  nameSection: {
    marginTop: spacing.sm,
  },
  nameLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  nameList: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  deleteText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  editLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  editInput: {
    backgroundColor: colors.cardLight,
    color: colors.text,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  editSaveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  editSaveText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  editCancelButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  editCancelText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  // Squad styles
  squadBanner: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  squadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inSquadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 184, 148, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  inSquadText: {
    color: '#00b894',
    fontSize: 13,
    fontWeight: '600',
  },
  squadMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  squadMemberName: {
    fontSize: 15,
    color: colors.text,
  },
  squadSelectSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  squadSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 8,
  },
  squadSelectRowActive: {
    backgroundColor: 'rgba(0, 184, 148, 0.1)',
  },
  squadSelectName: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  announceSquadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  announceSquadText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
