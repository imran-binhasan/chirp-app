import React, { useMemo } from 'react';
import { Text, Linking, type StyleProp, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';

interface ParsedTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string }
  | { type: 'mention'; value: string; username: string };

const PATTERN = /(https?:\/\/[^\s]+)|@(\w+)/g;

function parse(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(PATTERN)) {
    const index = match.index;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    if (match[1]) {
      segments.push({ type: 'url', value: match[1] });
    } else if (match[2]) {
      segments.push({ type: 'mention', value: match[0], username: match[2] });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

const LINK_COLOR = '#1D9BF0';

/** Renders post/comment bodies with tappable links and @mentions. */
export const ParsedText = React.memo(({ text, style }: ParsedTextProps) => {
  const router = useRouter();
  // Parsing every post body on every list re-render is wasted work.
  const segments = useMemo(() => parse(text), [text]);

  return (
    <Text style={style}>
      {segments.map((segment, index) => {
        if (segment.type === 'url') {
          return (
            <Text
              key={index}
              style={{ color: LINK_COLOR, textDecorationLine: 'underline' }}
              onPress={() => {
                Linking.openURL(segment.value).catch(() => {});
              }}
              accessibilityRole="link"
            >
              {segment.value}
            </Text>
          );
        }

        if (segment.type === 'mention') {
          return (
            <Text
              key={index}
              style={{ color: LINK_COLOR }}
              onPress={() => router.push(`/user/${segment.username}`)}
              accessibilityRole="link"
            >
              {segment.value}
            </Text>
          );
        }

        return <Text key={index}>{segment.value}</Text>;
      })}
    </Text>
  );
});

ParsedText.displayName = 'ParsedText';
