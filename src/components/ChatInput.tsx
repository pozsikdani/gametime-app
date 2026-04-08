import React, { useState, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  onSend: (text: string) => void;
  onPickImage?: () => void;
  onPickGif?: () => void;
};

export default function ChatInput({ onSend, onPickImage, onPickGif }: Props) {
  const [text, setText] = useState('');
  const { colors } = useTheme();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.sm,
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    imageButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 4,
    },
    gifButton: {
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 4,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
    },
    gifButtonText: {
      fontSize: 12,
      fontWeight: '800',
    },
    input: {
      flex: 1,
      backgroundColor: colors.cardLight,
      color: colors.text,
      borderRadius: 20,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 15,
      maxHeight: 100,
      marginRight: spacing.sm,
    },
    sendButton: {
      backgroundColor: colors.accent,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {onPickImage && (
        <TouchableOpacity style={styles.imageButton} onPress={onPickImage}>
          <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      {onPickGif && (
        <TouchableOpacity style={styles.gifButton} onPress={onPickGif}>
          <Text style={[styles.gifButtonText, { color: colors.textSecondary }]}>GIF</Text>
        </TouchableOpacity>
      )}
      <TextInput
        style={styles.input}
        placeholder="Message..."
        placeholderTextColor={colors.textSecondary}
        value={text}
        onChangeText={setText}
        maxLength={1000}
        multiline
        maxNumberOfLines={5}
      />
      <TouchableOpacity
        style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim()}
      >
        <Ionicons name="send" size={20} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}
