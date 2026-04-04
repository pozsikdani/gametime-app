import React, { useState, useEffect, useCallback } from 'react';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
  Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdmin } from '../hooks/useAdmin';
import { useTeam } from '../contexts/TeamContext';
import { pickImage, takePhoto, uploadProfilePhoto, savePhotoUrl } from '../services/profilePhoto';

const POSITION_OPTIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const JERSEY_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const ROLE_OPTIONS = ['Player', 'Coach', 'Admin'];

interface PlayerProfile {
  role: string;           // Szerep
  idNumber: string;       // SZIG szám
  jerseyNumber: string;   // Mezszám
  position: string[];     // Posztok (multi)
  height: string;         // Magasság (cm)
  weight: string;         // Súly (kg)
  phone: string;          // Telefonszám
  jerseySize: string;     // Mezméret
  medicalExpiry: string;  // Medical clearance expiry
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
  medicalExpiry: '',
};

export default function ProfileScreen({ navigation }: any) {
  const user = auth.currentUser;
  const isAdmin = useAdmin();
  const { activeTeamId, activeTeam, membership } = useTeam();
  const isGuest = membership?.role === 'guest';
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [memberSince, setMemberSince] = useState('');
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(EMPTY_PROFILE);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

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
            medicalExpiry: data.medicalExpiry || '',
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
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take photo', 'Gallery'],
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
      Alert.alert('Profile photo', 'Choose source', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take photo',
          onPress: async () => {
            const uri = await takePhoto();
            if (uri) handlePhotoUpload(uri);
          },
        },
        {
          text: 'Gallery',
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
      Alert.alert('Success', 'Name updated!');
    } catch (e) {
      Alert.alert('Error', 'Failed to update name');
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
      Alert.alert('Error', 'Failed to save');
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
      Alert.alert('Error', 'Failed to save');
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
      Alert.alert('Error', 'Failed to save');
    }
  };

  const toggleNotifPref = async (key: string, value: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [`notificationPrefs.${key}`]: value,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to save');
    }
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
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
      Alert.alert('Success', 'Password changed!');
    } catch (e: any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        Alert.alert('Error', 'Current password is incorrect');
      } else {
        Alert.alert('Error', 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut(auth) },
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
              {isEditing ? 'Save' : 'Edit'}
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
            {playerProfile[field] || 'Not set'}
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 90 : 0}
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
              name={isAdmin ? 'shield-checkmark' : isGuest ? 'eye-outline' : 'person'}
              size={14}
              color={isAdmin ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.roleBadgeText, isAdmin && styles.roleBadgeTextAdmin]}>
              {isAdmin ? 'Admin' : isGuest ? 'Guest' : 'User'}
            </Text>
          </View>
        </View>

        {/* Team Members button (admin only) */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.membersButton}
            onPress={() => navigation.navigate('Members')}
          >
            <Ionicons name="people-outline" size={20} color={colors.text} />
            <Text style={styles.membersButtonText}>Team members</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Name */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>Name</Text>
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
                {isEditingName ? 'Save' : 'Edit'}
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
            <Text style={styles.cardValue}>{user?.displayName || 'Unknown'}</Text>
          )}
        </View>

        {/* Role */}
        {/* Role is managed by admins via Members screen — not editable here */}

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
              <Text style={styles.cardLabel}>Active team</Text>
            </View>
            <Text style={styles.cardValue}>{activeTeam.name}</Text>
          </View>
        )}

        {/* Section: Player data */}
        <Text style={styles.sectionHeader}>Player info</Text>

        {renderEditableField('card-outline', 'ID number', 'idNumber', 'default', 'e.g. 123456AB')}
        {renderEditableField('shirt-outline', 'Jersey number', 'jerseyNumber', 'numeric', 'e.g. 7')}
        {renderMultiOptionField('basketball-outline', 'Position', 'position', POSITION_OPTIONS)}
        {renderEditableField('resize-outline', 'Height (cm)', 'height', 'numeric', 'e.g. 185')}
        {renderEditableField('barbell-outline', 'Weight (kg)', 'weight', 'numeric', 'e.g. 80')}
        {renderEditableField('call-outline', 'Phone number', 'phone', 'phone-pad', 'e.g. +36301234567')}
        {renderOptionField('shirt-outline', 'Jersey size', 'jerseySize', JERSEY_SIZE_OPTIONS)}
        {/* Medical clearance expiry — date picker */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="medical-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>Medical clearance expiry</Text>
            <TouchableOpacity onPress={() => {
              setTempDate(playerProfile.medicalExpiry ? new Date(playerProfile.medicalExpiry) : new Date());
              setShowDatePicker(true);
            }}>
              <Text style={styles.editButton}>
                {playerProfile.medicalExpiry ? 'Change' : 'Set'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.fieldDisplayValue, !playerProfile.medicalExpiry && styles.fieldDisplayEmpty]}>
            {playerProfile.medicalExpiry || 'Not set'}
          </Text>
        </View>
        <Modal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.dateModalOverlay}>
            <View style={styles.dateModalContent}>
              <Text style={styles.dateModalTitle}>Medical clearance expiry</Text>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
                  if (selectedDate) setTempDate(selectedDate);
                }}
                minimumDate={new Date()}
                maximumDate={new Date(2030, 11, 31)}
                textColor={colors.text}
              />
              <View style={styles.dateModalButtons}>
                <TouchableOpacity
                  style={styles.dateModalButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.dateModalButtonCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateModalButton, styles.dateModalButtonOk]}
                  onPress={async () => {
                    if (memberDocPath) {
                      const formatted = tempDate.toISOString().split('T')[0];
                      try {
                        await updateDoc(memberDocPath, { medicalExpiry: formatted });
                        setPlayerProfile((prev) => ({ ...prev, medicalExpiry: formatted }));
                      } catch (e) {
                        Alert.alert('Error', 'Failed to save');
                      }
                    }
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.dateModalButtonOkText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Notifications */}
        <Text style={styles.sectionHeader}>Notifications</Text>

        <View style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.notifInfo}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.textSecondary} />
              <View>
                <Text style={styles.notifLabel}>Chat messages</Text>
                <Text style={styles.notifDesc}>Notify on new messages</Text>
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
                <Text style={styles.notifLabel}>Polls</Text>
                <Text style={styles.notifDesc}>Notify when a poll closes</Text>
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
                <Text style={styles.notifLabel}>Events</Text>
                <Text style={styles.notifDesc}>Notify on new or updated events</Text>
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
        <Text style={styles.sectionHeader}>Account</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>Member since</Text>
          </View>
          <Text style={styles.cardValue}>{memberSince || 'Loading...'}</Text>
        </View>

        {/* Password change */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => setShowPasswordChange(!showPasswordChange)}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.cardLabel}>Change password</Text>
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
              placeholder="Current password"
              placeholderTextColor={colors.textSecondary}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
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
                {loading ? 'Saving...' : 'Save password'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
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
  membersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  membersButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  fieldDisplayValue: {
    fontSize: 15,
    color: colors.text,
    paddingTop: spacing.xs,
  },
  fieldDisplayEmpty: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateModalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    width: '85%',
    alignItems: 'center',
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  dateModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  dateModalButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.cardLight,
  },
  dateModalButtonCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dateModalButtonOk: {
    backgroundColor: colors.accent,
  },
  dateModalButtonOkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
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
