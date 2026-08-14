import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes, which would otherwise unmount the whole tree
 * and leave the user on a blank screen. Network failures are ApiError's job.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Where a crash reporter (Sentry, Crashlytics) would hook in.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container} testID="error-boundary-fallback">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected problem. You can try again — your account and chirps are safe.
        </Text>
        {__DEV__ ? <Text style={styles.debug}>{error.message}</Text> : null}
        <TouchableOpacity
          onPress={this.reset}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

// Deliberately theme-free: the theme hook itself may be what failed.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#faf9f8',
  },
  title: { fontSize: 22, fontWeight: '600', color: '#1a1c1c', marginBottom: 12 },
  body: { fontSize: 15, color: '#57423a', textAlign: 'center', lineHeight: 22 },
  debug: {
    fontSize: 12,
    color: '#9c2b2b',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  button: {
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#1a1c1c',
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
});
