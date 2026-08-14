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

/**
 * URLs first, so an `@` inside a link stays part of the link. A mention must
 * then start the string or follow a non-word character, or the domain of
 * "jane@example.com" becomes a profile link. The boundary is captured rather
 * than looked behind: lookbehind support varies across React Native's engines.
 */
const PATTERN = /(https?:\/\/\S+)|(^|[^\w@])@(\w+)/g;

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
    } else if (match[3]) {
      // The boundary character is prose, not part of the link.
      const boundary = match[2];
      if (boundary) segments.push({ type: 'text', value: boundary });
      segments.push({ type: 'mention', value: `@${match[3]}`, username: match[3] });
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
