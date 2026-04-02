import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import {
  updateProfile,
  updatePassword,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { colors, spacing } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from '../hooks/useAdmin';
import { useTeam } from '../contexts/TeamContext';
import { pickImage, takePhoto, uploadProfilePhoto, savePhotoUrl } from '../services/profilePhoto';

const POSITION_OPTIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const JERSEY_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const ROLE_OPTIONS = ['Játékos', 'Edző', 'Adminisztráció'];

interface PlayerProfile {
  role: string;           // Szerep
  idNumber: string;       // SZIG szám
  jerseyNumber: string;   // Mezszám
  position: string[];     // Posztok (multi)
  height: string;         // Magasság (cm)
  weight: string;         // Súly (kg)
  phone: string;          // Telefonszám
  jerseySize: string;     // Mezméret
}

const EMPTY_PROFILE: PlayerProfile = {
  role: '',
  idNumber: '',
  jerseyNumber: '',
  position: [],
  height: '',
  weight: '',
  phone: '',
  jerseySize: '',
};

export default function ProfileScreen() {
  const user = auth.currentUser;
  const isAdmin = useAdmin();
  const { activeTeamId, activeTeam } = useTeam();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [memberSince, setMemberSince] = useState('');
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(EMPTY_PROFILE);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Profile photo
  const [photoURL, setPhotoURL] = useState<string | null>(user?.photoURL || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Notification preferences
  const [notifChat, setNotifChat] = useState(true);
  const [notifPolls, setNotifPolls] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [activeTeamId]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      // Load global user data
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.createdAt) {
          const date = data.createdAt.toDate();
          setMemberSince(
            date.toLocaleDateString('hu-HU', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          );
        }
        if (data.photoURL) setPhotoURL(data.photoURL);
        // Notification preferences
        const notifPrefs = data.notificationPrefs || {};
        setNotifChat(notifPrefs.chat !== false);
        setNotifPolls(notifPrefs.polls !== false);
        setNotifEvents(notifPrefs.events !== false);
      }

      // Load team-specific membership data
      if (activeTeamId) {
        const memberDoc = await getDoc(doc(db, 'teams', activeTeamId, 'members', user.uid));
        if (memberDoc.exists()) {
          const data = memberDoc.data();
          setPlayerProfile({
            role: data.role || '',
            idNumber: data.idNumber || '',
            jerseyNumber: data.jerseyNumber || '',
            position: Array.isArray(data.position) ? data.position : data.position ? [data.position] : [],
            height: data.height || '',
            weight: data.weight || '',
            phone: data.phone || '',
            jerseySize: data.jerseySize || '',
          });
        }
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  };

  const handlePhotoUpload = async (uri: string) => {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(user.uid, uri);
      await savePhotoUrl(user.uid, url);
      setPhotoURL(url);
    } catch (e) {
      Alert.alert('Hiba', 'Nem sikerült feltölteni a képet');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Mégsem', 'Fotó készítése', 'Galéria'],
          cancelButtonIndex: 0,
        },
        async (index) => {
          let uri: string | null = null;
          if (index === 1) uri = await takePhoto();
          else if (index === 2) uri = await pickImage();
          if (uri) handlePhotoUpload(uri);
        }
      );
    } else {
      Alert.alert('Profilkép', 'Válassz forrást', [
        { text: 'Mégsem', style: 'cancel' },
        {
          text: 'Fotó készítése',
          onPress: async () => {
            const uri = await takePhoto();
            if (uri) handlePhotoUpload(uri);
          },
        },
        {
          text: 'Galéria',
          onPress: async () => {
            const uri = await pickImage();
            if (uri) handlePhotoUpload(uri);
          },
        },
      ]);
    }
  };

  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
      });
      setIsEditingName(false);
      Alert.alert('Siker', 'Név frissítve!');
    } catch (e) {
      Alert.alert('Hiba', 'Nem sikerült frissíteni a nevet');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const memberDocPath = activeTeamId
    ? doc(db, 'teams', activeTeamId, 'members', user?.uid || '_')
    : null;

  const saveField = async (field: keyof PlayerProfile) => {
    if (!user || !memberDocPath) return;
    setLoading(true);
    try {
      await updateDoc(memberDocPath, { [field]: editValue.trim() });
      setPlayerProfile((prev) => ({ ...prev, [field]: editValue.trim() }));
      setEditingField(null);
    } catch (e) {
      Alert.alert('Hiba', 'Nem sikerült menteni');
    } finally {
      setLoading(false);
    }
  };

  const selectOption = async (field: keyof PlayerProfile, value: string) => {
    if (!user || !memberDocPath) return;
    const current = playerProfile[field] as string;
    const newValue = current === value ? '' : value;
    try {
      await updateDoc(memberDocPath, { [field]: newValue });
      setPlayerProfile((prev) => ({ ...prev, [field]: newValue }));
    } catch (e) {
      Alert.alert('Hiba', 'Nem sikerült menteni');
    }
  };

  const toggleMultiOption = async (field: keyof PlayerProfile, value: string) => {
    if (!user || !memberDocPath) return;
    const current = playerProfile[field] as string[];
    const newValue = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    try {
      await updateDoc(memberDocPath, { [field]: newValue });
      setPlayerProfile((prev) => ({ ...prev, [field]: newValue }));
    } catch (e) {
      Alert.alert('Hiba', 'Nem sikerült menteni');
    }
  };

  const toggleNotifPref = async (key: string, value: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [`notificationPrefs.${key}`]: value,
      });
    } catch (e) {
      Alert.alert('Hiba', 'Nem sikerült menteni');
    }
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Hiba', 'Minden mező kitöltése kötelező');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Hiba', 'Az új jelszónak legalább 6 karakter hosszúnak kell lennie');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Hiba', 'Az új jelszavak nem egyeznek');
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
      Alert.alert('Siker', 'Jelszó megváltoztatva!');
    } catch (e: any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        Alert.alert('Hiba', 'Hibás jelenlegi jelszó');
      } else {
        Alert.alert('Hiba', 'Nem sikerült megváltoztatni a jelszót');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Kilépés', 'Biztosan ki szeretnél lépni?', [
      { text: 'Mégsem', style: 'cancel' },
      { text: 'Kilépés', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  const renderEditableField = (
    icon: string,
    label: string,
    field: keyof PlayerProfile,
    keyboard: 'default' | 'numeric' | 'phone-pad' = 'default',
    placeholder = '',
  ) => {
    const isEditing = editingField === field;
    return (
      <View style={styles.card} key={field}>
        <View style={styles.cardHeader}>
          <Ionicons name={icon as any} size={20} color={colors.textSecondary} />
          <Text style={styles.cardLabel}>{label}</Text>
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                saveField(field);
              } else {
                startEditing(field, playerProfile[field] as string);
              }
            }}
          >
            <Text style={styles.editButton}>
              {isEditing ? 'Mentés' : 'Szerkesztés'}
            </Text>
          </TouchableOpacity>
        </View>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={editValue}
            onChangeText={setEditValue}
            autoFocus
            keyboardType={keyboard}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={() => saveField(field)}
          />
        ) : (
          <Text style={[styles.cardValue, !playerProfile[field] && styles.emptyValue]}>
            {playerProfile[field] || 'Nincs megadva'}
          </Text>
        )}
      </View>
    );
  };

  const renderOptionField = (
    icon: string,
    label: string,
    field: keyof PlayerProfile,
    options: string[],
  ) => {
    return (
      <View style={styles.card} key={field}>
        <View style={styles.cardHeader}>
          <Ionicons name={icon as any} size={20} color={colors.textSecondary} />
          <Text style={styles.cardLabel}>{label}</Text>
        </View>
        <View style={styles.optionRow}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.optionChip,
                playerProfile[field] === opt && styles.optionChipActive,
              ]}
              onPress={() => selectOption(field, opt)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  playerProfile[field] === opt && styles.optionChipTextActive,
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderMultiOptionField = (
    icon: string,
    label: string,
    field: keyof PlayerProfile,
    options: string[],
  ) => {
    const selected = playerProfile[field] as string[];
    return (
      <View style={styles.card} key={field}>
        <View style={styles.cardHeader}>
          <Ionicons name={icon as any} size={20} color={colors.textSecondary} />
          <Text style={styles.cardLabel}>{label}</Text>
        </View>
        <View style={styles.optionRow}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.optionChip,
                selected.includes(opt) && styles.optionChipActive,
              ]}
              onPress={() => toggleMultiOption(field, opt)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  selected.includes(opt) && styles.optionChipTextActive,
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
            {uploadingPhoto ? (
              <View style={styles.avatar}>
                <ActivityIndicator size="small" color={colors.text} />
              </View>
            ) : photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user?.displayName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={14} color={colors.text} />
            </View>
          </TouchableOpacity>
          {playerProfile.jerseyNumber ? (
            <View style={styles.jerseyBadge}>
              <Text style={styles.jerseyBadgeText}>#{playerProfile.jerseyNumber}</Text>
            </View>
          ) : null}
          <View style={[styles.roleBadge, isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
            <Ionicons
              name={isAdmin ? 'shield-checkmark' : 'person'}
              size={14}
              color={isAdmin ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.roleBadgeText, isAdmin && styles.roleBadgeTextAdmin]}>
              {isAdmin ? 'Admin' : 'User'}
            </Text>
          </View>
        </View>

        {/* Name */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>Név</Text>
            <TouchableOpacity
              onPress={() => {
                if (isEditingName) {
                  handleSaveName();
                } else {
                  setIsEditingName(true);
                }
              }}
            >
              <Text style={styles.editButton}>
                {isEditingName ? 'Mentés' : 'Szerkesztés'}
              </Text>
            </TouchableOpacity>
          </View>
          {isEditingName ? (
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              onSubmitEditing={handleSaveName}
            />
          ) : (
            <Text style={styles.cardValue}>{user?.displayName || 'Ismeretlen'}</Text>
          )}
        </View>

        {/* Role */}
        {renderOptionField('shield-outline', 'Szerepkör', 'role', ROLE_OPTIONS)}

        {/* Email (read-only) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>Email</Text>
          </View>
          <Text style={styles.cardValue}>{user?.email || ''}</Text>
        </View>

        {/* Active team */}
        {activeTeam && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.cardLabel}>Aktív csapat</Text>
            </View>
            <Text style={styles.cardValue}>{activeTeam.name}</Text>
          </View>
        )}

        {/* Section: Player data */}
        <Text style={styles.sectionHeader}>Játékos adatok</Text>

        {renderEditableField('card-outline', 'Személyi ig. szám', 'idNumber', 'default', 'pl. 123456AB')}
        {renderEditableField('shirt-outline', 'Mezszám', 'jerseyNumber', 'numeric', 'pl. 7')}
        {renderMultiOptionField('basketball-outline', 'Poszt', 'position', POSITION_OPTIONS)}
        {renderEditableField('resize-outline', 'Magasság (cm)', 'height', 'numeric', 'pl. 185')}
        {renderEditableField('barbell-outline', 'Súly (kg)', 'weight', 'numeric', 'pl. 80')}
        {renderEditableField('call-outline', 'Telefonszám', 'phone', 'phone-pad', 'pl. +36301234567')}
        {renderOptionField('shirt-outline', 'Mezméret', 'jerseySize', JERSEY_SIZE_OPTIONS)}

        {/* Notifications */}
        <Text style={styles.sectionHeader}>Értesítések</Text>

        <View style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.notifInfo}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={styles.notifLabel}>Chat üzenetek</Text>
                <Text style={styles.notifDesc}>Értesítés új üzenet érkezésekor</Text>
              </View>
            </View>
            <Switch
              value={notifChat}
              onValueChange={(val) => {
                setNotifChat(val);
                toggleNotifPref('chat', val);
              }}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.notifInfo}>
              <Ionicons name="bar-chart-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={styles.notifLabel}>Szavazások</Text>
                <Text style={styles.notifDesc}>Értesítés szavazás lezárásakor</Text>
              </View>
            </View>
            <Switch
              value={notifPolls}
              onValueChange={(val) => {
                setNotifPolls(val);
                toggleNotifPref('polls', val);
              }}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.notifInfo}>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={styles.notifLabel}>Események</Text>
                <Text style={styles.notifDesc}>Értesítés új vagy módosított eseményeknél</Text>
              </View>
            </View>
            <Switch
              value={notifEvents}
              onValueChange={(val) => {
                setNotifEvents(val);
                toggleNotifPref('events', val);
              }}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {/* Member since */}
        <Text style={styles.sectionHeader}>Fiók</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>Tag mióta</Text>
          </View>
          <Text style={styles.cardValue}>{memberSince || 'Betöltés...'}</Text>
        </View>

        {/* Password change */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => setShowPasswordChange(!showPasswordChange)}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>Jelszó változtatás</Text>
            <Ionicons
              name={showPasswordChange ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {showPasswordChange && (
          <View style={styles.passwordSection}>
            <TextInput
              style={styles.input}
              placeholder="Jelenlegi jelszó"
              placeholderTextColor={colors.textSecondary}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Új jelszó"
              placeholderTextColor={colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Új jelszó megerősítése"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.passwordButton, loading && styles.buttonDisabled]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              <Text style={styles.passwordButtonText}>
                {loading ? 'Mentés...' : 'Jelszó mentése'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Kilépés</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  jerseyBadge: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    marginTop: -12,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  jerseyBadgeText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
  },
  roleBadgeAdmin: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(196, 30, 58, 0.15)',
  },
  roleBadgeUser: {
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleBadgeTextAdmin: {
    color: colors.accent,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  cardValue: {
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyValue: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  editButton: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.cardLight,
    color: colors.text,
    borderRadius: 10,
    padding: spacing.sm + 4,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  optionChip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  optionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  optionChipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: colors.text,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  notifLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  notifDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  passwordSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginTop: -spacing.sm + 2,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  passwordButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  passwordButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  logoutText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
