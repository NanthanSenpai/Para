import React from 'react';
import { Text, Linking, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface RichTextProps {
  content: string;
  style?: TextStyle;
  onPressHashtag?: (tag: string) => void;
  onPressMention?: (username: string) => void;
}

const TOKEN_REGEX = /(https?:\/\/[^\s]+|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]{3,20})/g;

export const RichText: React.FC<RichTextProps> = ({
  content,
  style,
  onPressHashtag,
  onPressMention,
}) => {
  const { colors } = useTheme();
  const parts = content.split(TOKEN_REGEX);

  return (
    <Text style={[{ color: colors.text, fontSize: 15, lineHeight: 20 }, style]}>
      {parts.map((part, idx) => {
        if (!part) return null;

        if (part.startsWith('http://') || part.startsWith('https://')) {
          return (
            <Text
              key={idx}
              style={{ color: colors.accent }}
              onPress={() => Linking.openURL(part).catch(() => {})}
            >
              {part}
            </Text>
          );
        }

        if (part.startsWith('#')) {
          return (
            <Text
              key={idx}
              style={{ color: colors.accent }}
              onPress={() => onPressHashtag?.(part)}
            >
              {part}
            </Text>
          );
        }

        if (part.startsWith('@')) {
          return (
            <Text
              key={idx}
              style={{ color: colors.accent }}
              onPress={() => onPressMention?.(part.slice(1))}
            >
              {part}
            </Text>
          );
        }

        return <Text key={idx}>{part}</Text>;
      })}
    </Text>
  );
};
