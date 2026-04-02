import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../types';
import { colors, spacing } from '../constants/theme';

type Props = {
  message: Message;
  isOwn: boolean;
};

function SenderAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  if (photoURL) {
    return <Image source={{ uri: photoURL }} style={styles.avatar} />;
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function MessageBubble({ message, isOwn }: Props) {
  const time = message.createdAt
    ? message.createdAt.toDate().toLocaleTimeString('hu-HU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  if (message.type === 'system') {
    const isCalendar = message.senderName === 'Naptár';
    const icon = isCalendar ? 'calendar' : 'bar-chart';
    const title = isCalendar
      ? (message.text.startsWith('Új ') ? 'Új esemény' : 'Esemény módosítva')
      : 'Szavazás lezárva';
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
        <View style={[styles.bubble, styles.bubbleOwn]}>
          <Text style={styles.text}>{message.text}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, styles.wrapperOther]}>
      <SenderAvatar name={message.senderName} photoURL={message.senderPhotoURL} />
      <View style={[styles.bubble, styles.bubbleOther]}>
        <Text style={styles.sender}>{message.senderName}</Text>
        <Text style={styles.text}>{message.text}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  wrapperOwn: {
    justifyContent: 'flex-end',
  },
  wrapperOther: {
    justifyContent: 'flex-start',
    gap: spacing.xs + 2,
  },
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
  bubble: {
    maxWidth: '75%',
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
});
