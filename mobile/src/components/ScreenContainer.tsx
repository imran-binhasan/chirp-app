import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useResponsive } from '../utils/responsive';
import { useThemeColors } from '../utils/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  edges?: readonly Edge[];
  style?: ViewStyle;
}

/**
 * Safe-area screen shell that also caps content width on tablets, so every
 * screen picks up the responsive layout without repeating the logic.
 */
export function ScreenContainer({
  children,
  edges = ['top'],
  style,
}: ScreenContainerProps) {
  const theme = useThemeColors();
  const { contentMaxWidth } = useResponsive();

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.background }, style]} edges={edges}>
      <View style={{ flex: 1, width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
