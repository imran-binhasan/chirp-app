import React from 'react';
import { Linking } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ParsedText } from '../ParsedText';

const { __mockRouter } = jest.requireMock('expo-router') as {
  __mockRouter: { push: jest.Mock };
};

beforeEach(() => jest.clearAllMocks());

describe('ParsedText', () => {
  it('renders plain text unchanged', async () => {
    await render(<ParsedText text="just a normal chirp" />);
    expect(screen.getByText('just a normal chirp')).toBeTruthy();
  });

  it('turns a mention into a link to that profile', async () => {
    await render(<ParsedText text="hey @jane look at this" />);

    await fireEvent.press(screen.getByText('@jane'));

    expect(__mockRouter.push).toHaveBeenCalledWith('/user/jane');
  });

  it('opens URLs through the OS handler', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<ParsedText text="see https://example.com/docs" />);

    await fireEvent.press(screen.getByText('https://example.com/docs'));

    expect(openURL).toHaveBeenCalledWith('https://example.com/docs');
  });

  it('handles a mention and a URL in the same body', async () => {
    await render(<ParsedText text="@jane shipped https://example.com today" />);

    expect(screen.getByText('@jane')).toBeTruthy();
    expect(screen.getByText('https://example.com')).toBeTruthy();
    expect(screen.getByText(' today')).toBeTruthy();
  });

  it('does not linkify a bare @ with no username', async () => {
    await render(<ParsedText text="email me @ home" />);
    expect(screen.queryByText('@ ')).toBeNull();
    expect(screen.getByText('email me @ home')).toBeTruthy();
  });

  it('handles adjacent mentions without swallowing text between them', async () => {
    await render(<ParsedText text="@a @b" />);

    expect(screen.getByText('@a')).toBeTruthy();
    expect(screen.getByText('@b')).toBeTruthy();
  });

  it('renders an empty body without crashing', async () => {
    const result = await render(<ParsedText text="" />);
    expect(result.toJSON()).toBeTruthy();
  });
});
