import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Pressable, TouchableOpacity, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Message } from '../types';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

type Props = {
  message: Message;
  isOwn: boolean;
  currentUid?: string;
  showPicker?: boolean;
  readByCount?: number;
  onLongPress?: (messageId: string) => void;
  onReactionPress?: (messageId: string, emoji: string) => void;
  onReadByPress?: (messageId: string) => void;
};

function SenderAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    avatarFallback: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.cardLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
  }), [colors]);

  if (photoURL) {
    return <Image source={{ uri: photoURL }} style={styles.avatar} />;
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function ReactionPills({
  reactions,
  currentUid,
  onPress,
}: {
  reactions: { [emoji: string]: string[] };
  currentUid?: string;
  onPress?: (emoji: string) => void;
}) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    reactionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 2,
      marginBottom: -4,
      paddingHorizontal: 4,
    },
    reactionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 2,
    },
    reactionPillMine: {
      borderColor: colors.accent,
      backgroundColor: 'rgba(196, 30, 58, 0.15)',
    },
    reactionEmoji: {
      fontSize: 14,
    },
    reactionCount: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  }), [colors]);

  const entries = Object.entries(reactions).filter(([, uids]) => uids.length > 0);
  if (entries.length === 0) return null;

  return (
    <View style={styles.reactionsRow}>
      {entries.map(([emoji, uids]) => {
        const isMine = currentUid ? uids.includes(currentUid) : false;
        return (
          <TouchableOpacity
            key={emoji}
            style={[styles.reactionPill, isMine && styles.reactionPillMine]}
            onPress={() => onPress?.(emoji)}
            activeOpacity={0.7}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {uids.length > 1 && <Text style={styles.reactionCount}>{uids.length}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function EmojiPickerBar({
  isOwn,
  onSelect,
}: {
  isOwn: boolean;
  onSelect: (emoji: string) => void;
}) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    pickerBar: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: 24,
      paddingHorizontal: 6,
      paddingVertical: 4,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'flex-start',
    },
    pickerBarOwn: {
      alignSelf: 'flex-end',
    },
    pickerBarOther: {
      alignSelf: 'flex-start',
    },
    pickerEmoji: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerEmojiText: {
      fontSize: 20,
    },
  }), [colors]);

  return (
    <View style={[styles.pickerBar, isOwn ? styles.pickerBarOwn : styles.pickerBarOther]}>
      {REACTION_EMOJIS.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={styles.pickerEmoji}
          onPress={() => onSelect(emoji)}
        >
          <Text style={styles.pickerEmojiText}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function MessageBubble({ message, isOwn, currentUid, showPicker, readByCount, onLongPress, onReactionPress, onReadByPress }: Props) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const [showFullImage, setShowFullImage] = React.useState(false);
  const { colors } = useTheme();

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onLongPress?.(message.id);
  };

  const time = message.createdAt
    ? message.createdAt.toDate().toLocaleTimeString('hu-HU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const hasReactions = message.reactions && Object.keys(message.reactions).some(
    (k) => message.reactions![k].length > 0
  );

  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    wrapperOwn: {
      justifyContent: 'flex-end',
    },
    wrapperOther: {
      justifyContent: 'flex-start',
      gap: spacing.xs + 2,
    },
    bubble: {
      maxWidth: 280,
      borderRadius: 16,
      padding: spacing.sm + 4,
      paddingBottom: spacing.sm,
    },
    bubbleOwn: {
      backgroundColor: colors.accent,
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      backgroundColor: colors.card,
      borderBottomLeftRadius: 4,
    },
    bubbleImage: {
      padding: spacing.xs,
      paddingBottom: spacing.xs,
    },
    chatImage: {
      width: 220,
      height: 220,
      borderRadius: 12,
    },
    gifBadge: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    gifBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
    },
    fullImageOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
    },
    fullImage: {
      width: '100%',
      height: '80%',
    },
    seenByRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: 3,
      marginTop: 2,
      paddingHorizontal: 4,
    },
    seenByText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    sender: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
      marginBottom: 2,
    },
    text: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 20,
    },
    time: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.5)',
      alignSelf: 'flex-end',
      marginTop: 4,
    },
    // System message styles
    systemWrapper: {
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      alignItems: 'center',
    },
    systemCard: {
      width: '90%',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(0, 206, 201, 0.3)',
    },
    systemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    systemTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#00cec9',
    },
    systemText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
    },
    systemTime: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.4)',
      alignSelf: 'flex-end',
      marginTop: spacing.xs,
    },
  }), [colors]);

  if (message.type === 'system') {
    const isCalendar = message.senderName === 'Calendar';
    const icon = isCalendar ? 'calendar' : 'bar-chart';
    const title = isCalendar
      ? (message.text.startsWith('Új ') ? 'New event' : 'Event updated')
      : 'Poll closed';
    const accentColor = isCalendar ? '#fdcb6e' : '#00cec9';

    return (
      <View style={styles.systemWrapper}>
        <View style={[styles.systemCard, { borderColor: `${accentColor}4D` }]}>
          <View style={styles.systemHeader}>
            <Ionicons name={icon} size={16} color={accentColor} />
            <Text style={[styles.systemTitle, { color: accentColor }]}>{title}</Text>
          </View>
          <Text style={styles.systemText}>{message.text}</Text>
          <Text style={styles.systemTime}>{time}</Text>
        </View>
      </View>
    );
  }

  if (isOwn) {
    return (
      <View style={[styles.wrapper, styles.wrapperOwn]}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {showPicker && (
            <EmojiPickerBar
              isOwn
              onSelect={(emoji) => onReactionPress?.(message.id, emoji)}
            />
          )}
          <Pressable
            style={[styles.bubble, styles.bubbleOwn, (message.type === 'image' || message.type === 'gif') && styles.bubbleImage]}
            onLongPress={handleLongPress}
            delayLongPress={300}
          >
            {message.type === 'image' && message.imageURL ? (
              <TouchableOpacity onPress={() => setShowFullImage(true)} activeOpacity={0.9}>
                <Image source={{ uri: message.imageURL }} style={styles.chatImage} resizeMode="cover" />
              </TouchableOpacity>
            ) : message.type === 'gif' && message.gifUrl ? (
              <TouchableOpacity onPress={() => setShowFullImage(true)} activeOpacity={0.9}>
                <Image source={{ uri: message.gifUrl }} style={styles.chatImage} resizeMode="cover" />
                <View style={styles.gifBadge}><Text style={styles.gifBadgeText}>GIF</Text></View>
              </TouchableOpacity>
            ) : (
              <Text style={styles.text}>{message.text}</Text>
            )}
            <Text style={styles.time}>{time}</Text>
          </Pressable>
          {hasReactions && (
            <ReactionPills
              reactions={message.reactions!}
              currentUid={currentUid}
              onPress={(emoji) => onReactionPress?.(message.id, emoji)}
            />
          )}
          {isOwn && readByCount !== undefined && readByCount > 0 && (
            <TouchableOpacity
              style={styles.seenByRow}
              onPress={() => onReadByPress?.(message.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-done-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.seenByText}>Seen by {readByCount}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
        {(message.imageURL || message.gifUrl) && (
          <Modal visible={showFullImage} transparent animationType="fade">
            <Pressable style={styles.fullImageOverlay} onPress={() => setShowFullImage(false)}>
              <Image source={{ uri: message.imageURL || message.gifUrl }} style={styles.fullImage} resizeMode="contain" />
            </Pressable>
          </Modal>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, styles.wrapperOther]}>
      <SenderAvatar name={message.senderName} photoURL={message.senderPhotoURL} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {showPicker && (
          <EmojiPickerBar
            isOwn={false}
            onSelect={(emoji) => onReactionPress?.(message.id, emoji)}
          />
        )}
        <Pressable
          style={[styles.bubble, styles.bubbleOther, (message.type === 'image' || message.type === 'gif') && styles.bubbleImage]}
          onLongPress={handleLongPress}
          delayLongPress={300}
        >
          <Text style={styles.sender}>{message.senderName}</Text>
          {message.type === 'image' && message.imageURL ? (
            <TouchableOpacity onPress={() => setShowFullImage(true)} activeOpacity={0.9}>
              <Image source={{ uri: message.imageURL }} style={styles.chatImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : message.type === 'gif' && message.gifUrl ? (
            <TouchableOpacity onPress={() => setShowFullImage(true)} activeOpacity={0.9}>
              <Image source={{ uri: message.gifUrl }} style={styles.chatImage} resizeMode="cover" />
              <View style={styles.gifBadge}><Text style={styles.gifBadgeText}>GIF</Text></View>
            </TouchableOpacity>
          ) : (
            <Text style={styles.text}>{message.text}</Text>
          )}
          <Text style={styles.time}>{time}</Text>
        </Pressable>
        {hasReactions && (
          <ReactionPills
            reactions={message.reactions!}
            currentUid={currentUid}
            onPress={(emoji) => onReactionPress?.(message.id, emoji)}
          />
        )}
      </Animated.View>
      {message.imageURL && (
        <Modal visible={showFullImage} transparent animationType="fade">
          <Pressable style={styles.fullImageOverlay} onPress={() => setShowFullImage(false)}>
            <Image source={{ uri: message.imageURL }} style={styles.fullImage} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
