import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Pressable,
  ActionSheetIOS,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { pickChatImage, takeChatPhoto, uploadChatImage } from '../services/profilePhoto';
import { Message } from '../types';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import NextEventBanner from '../components/NextEventBanner';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useTeam } from '../contexts/TeamContext';
let GiphyDialog: any = null;
let GiphyDialogEvent: any = null;
try {
  const giphy = require('@giphy/react-native-sdk');
  GiphyDialog = giphy.GiphyDialog;
  GiphyDialogEvent = giphy.GiphyDialogEvent;
} catch (e) {
  // Giphy SDK not available (Expo Go)
}

type Props = {
  navigation: any;
};

export default function ChatScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [memberReads, setMemberReads] = useState<{ uid: string; name: string; lastReadAt: number }[]>([]);
  const [userProfiles, setUserProfiles] = useState<{ [uid: string]: { displayName: string; photoURL: string | null } }>({});
  const [seenByModalMsg, setSeenByModalMsg] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth.currentUser;
  const { activeTeamId } = useTeam();
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => StyleSheet.create({
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
    logoutText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    messageList: {
      flexGrow: 1,
      paddingVertical: spacing.md,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
      marginBottom: spacing.xs,
    },
    emptySubtext: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    uploadingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    uploadingText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    seenByOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    seenByModal: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 300,
      borderWidth: 1,
      borderColor: colors.border,
    },
    seenByTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    seenByItem: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    seenByName: {
      fontSize: 15,
      color: colors.text,
    },
    seenByEmpty: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
  }), [colors]);

  useEffect(() => {
    if (!activeTeamId) return;

    let unsubscribe: (() => void) | undefined;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const startListener = (attempt = 0) => {
      const q = query(
        collection(db, 'teams', activeTeamId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(100)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs: Message[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Message[];
        // Sort by createdAt, falling back to clientTimestamp for pending messages
        msgs.sort((a, b) => {
          const timeA = (a.createdAt || (a as any).clientTimestamp)?.toMillis?.() || Date.now();
          const timeB = (b.createdAt || (b as any).clientTimestamp)?.toMillis?.() || Date.now();
          return timeA - timeB;
        });
        setMessages(msgs);
        setLoading(false);
      }, (error) => {
        console.error('Chat listener error:', error);
        if (attempt < 3) {
          retryTimeout = setTimeout(() => startListener(attempt + 1), 1500);
        } else {
          setLoading(false);
        }
      });
    };

    startListener();

    return () => {
      unsubscribe?.();
      clearTimeout(retryTimeout);
    };
  }, [activeTeamId]);

  // Force Firestore reconnect when app comes to foreground + update lastReadAt
  useEffect(() => {
    const updateLastRead = () => {
      if (currentUser && activeTeamId) {
        updateDoc(doc(db, 'teams', activeTeamId, 'members', currentUser.uid), {
          lastReadAt: serverTimestamp(),
        }).catch(() => {});
      }
    };

    // Update on mount
    updateLastRead();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        disableNetwork(db).then(() => enableNetwork(db));
        updateLastRead();
      }
    });
    return () => sub.remove();
  }, [activeTeamId]);

  // Load member lastReadAt values + user profiles (for live photoURL)
  useEffect(() => {
    if (!activeTeamId) return;
    const q = query(collection(db, 'teams', activeTeamId, 'members'));
    const unsub = onSnapshot(q, async (snap) => {
      const reads = snap.docs
        .filter((d) => d.id !== currentUser?.uid)
        .map((d) => ({
          uid: d.id,
          name: d.data().displayName || 'Unknown',
          lastReadAt: d.data().lastReadAt?.toMillis?.() || 0,
        }));
      setMemberReads(reads);

      // Load user profiles for photoURL
      const profiles: { [uid: string]: { displayName: string; photoURL: string | null } } = {};
      for (const memberDoc of snap.docs) {
        const userSnap = await getDoc(doc(db, 'users', memberDoc.id));
        if (userSnap.exists()) {
          const data = userSnap.data();
          profiles[memberDoc.id] = {
            displayName: data.displayName || memberDoc.data().displayName || 'Unknown',
            photoURL: data.photoURL || null,
          };
        }
      }
      setUserProfiles(profiles);
    });
    return unsub;
  }, [activeTeamId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => sub.remove();
  }, []);

  const handleSend = async (text: string) => {
    if (!currentUser) return;

    await addDoc(collection(db, 'teams', activeTeamId!, 'messages'), {
      text,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Unknown',
      senderPhotoURL: currentUser.photoURL || null,
      createdAt: serverTimestamp(),
      clientTimestamp: Timestamp.now(),
      type: 'text',
    });
  };

  const handleSendImage = async (uri: string) => {
    if (!currentUser || !activeTeamId) return;
    setUploadingImage(true);
    try {
      // Create message doc first to get ID for storage path
      const msgRef = await addDoc(collection(db, 'teams', activeTeamId, 'messages'), {
        text: '',
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Unknown',
        senderPhotoURL: currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        clientTimestamp: Timestamp.now(),
        type: 'image',
        imageURL: '', // placeholder, updated after upload
      });

      const downloadURL = await uploadChatImage(activeTeamId, msgRef.id, uri);
      await updateDoc(doc(db, 'teams', activeTeamId, 'messages', msgRef.id), {
        imageURL: downloadURL,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePickImage = () => {
    const doUpload = async (uri: string | null) => {
      if (uri) handleSendImage(uri);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take photo', 'Gallery'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) doUpload(await takeChatPhoto());
          else if (idx === 2) doUpload(await pickChatImage());
        }
      );
    } else {
      Alert.alert('Send photo', 'Choose source', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take photo', onPress: async () => doUpload(await takeChatPhoto()) },
        { text: 'Gallery', onPress: async () => doUpload(await pickChatImage()) },
      ]);
    }
  };

  const getReadByCount = (message: Message): number => {
    if (!message.createdAt) return 0;
    const msgTime = message.createdAt.toMillis();
    return memberReads.filter((m) => m.lastReadAt >= msgTime).length;
  };

  const getReadByList = (messageId: string): { name: string; lastReadAt: number }[] => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.createdAt) return [];
    const msgTime = msg.createdAt.toMillis();
    return memberReads
      .filter((m) => m.lastReadAt >= msgTime)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // GIF picker
  const handlePickGif = GiphyDialog ? () => {
    GiphyDialog.show();
  } : undefined;

  useEffect(() => {
    if (!GiphyDialog || !GiphyDialogEvent) return;
    const handler = (e: any) => {
      const media = e.nativeEvent.media;
      const gifUrl = media.url;
      if (gifUrl && currentUser && activeTeamId) {
        addDoc(collection(db, 'teams', activeTeamId, 'messages'), {
          text: '',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Unknown',
          senderPhotoURL: currentUser.photoURL || null,
          createdAt: serverTimestamp(),
          clientTimestamp: Timestamp.now(),
          type: 'gif',
          gifUrl,
        });
      }
      GiphyDialog.hide();
    };
    const listener = GiphyDialog.addListener(GiphyDialogEvent.MediaSelected, handler);
    return () => listener.remove();
  }, [currentUser, activeTeamId]);

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser || !activeTeamId) return;
    const uid = currentUser.uid;
    const msgRef = doc(db, 'teams', activeTeamId, 'messages', messageId);
    const msg = messages.find((m) => m.id === messageId);
    const currentReactions = msg?.reactions?.[emoji] || [];
    const hasReacted = currentReactions.includes(uid);

    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: hasReacted ? arrayRemove(uid) : arrayUnion(uid),
    });
    setPickerMessageId(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>

      <NextEventBanner
        onPress={(eventId) => navigation.navigate('Calendar', {
          screen: 'EventDetail',
          params: { eventId },
        })}
      />

      {/* Dismiss overlay when picker is open */}
      {pickerMessageId && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setPickerMessageId(null)}
        />
      )}

      <FlatList
        ref={flatListRef}
        keyboardDismissMode="on-drag"
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const liveProfile = userProfiles[item.senderId];
          const messageWithLivePhoto = liveProfile
            ? { ...item, senderPhotoURL: liveProfile.photoURL || item.senderPhotoURL }
            : item;
          return (
          <MessageBubble
            message={messageWithLivePhoto}
            isOwn={item.senderId === currentUser?.uid}
            currentUid={currentUser?.uid}
            showPicker={item.id === pickerMessageId}
            readByCount={item.senderId === currentUser?.uid ? getReadByCount(item) : undefined}
            onLongPress={(id) => setPickerMessageId(id)}
            onReactionPress={toggleReaction}
            onReadByPress={(id) => setSeenByModalMsg(id)}
          />
          );
        }}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Be the first to write!</Text>
          </View>
        }
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
      />

      {uploadingImage && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.uploadingText}>Sending photo...</Text>
        </View>
      )}
      <ChatInput onSend={handleSend} onPickImage={handlePickImage} onPickGif={handlePickGif || undefined} />

      {/* Seen by modal */}
      <Modal visible={seenByModalMsg !== null} transparent animationType="fade">
        <Pressable style={styles.seenByOverlay} onPress={() => setSeenByModalMsg(null)}>
          <View style={styles.seenByModal}>
            <Text style={styles.seenByTitle}>Seen by</Text>
            {seenByModalMsg && getReadByList(seenByModalMsg).map((m) => (
              <View key={m.name} style={styles.seenByItem}>
                <Text style={styles.seenByName}>{m.name}</Text>
              </View>
            ))}
            {seenByModalMsg && getReadByList(seenByModalMsg).length === 0 && (
              <Text style={styles.seenByEmpty}>No one has seen this yet</Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
