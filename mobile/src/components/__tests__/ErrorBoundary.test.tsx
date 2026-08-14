import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('render exploded');
  return <Text>recovered content</Text>;
}

describe('ErrorBoundary', () => {
  // React logs the caught error; silence it so the suite output stays readable.
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('renders children when nothing throws', async () => {
    await render(
      <ErrorBoundary>
        <Text>all good</Text>
      </ErrorBoundary>,
    );

    expect(screen.getByText('all good')).toBeTruthy();
    expect(screen.queryByTestId('error-boundary-fallback')).toBeNull();
  });

  it('shows a recovery screen instead of unmounting the whole tree', async () => {
    await render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
  });

  it('recovers when the user retries and the cause is gone', async () => {
    const { rerender } = await render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy();

    // Swap in a child that no longer throws, then press Try again.
    await rerender(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    await fireEvent.press(screen.getByLabelText('Try again'));

    expect(await screen.findByText('recovered content')).toBeTruthy();
  });
});
