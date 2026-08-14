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

  it('does not mistake the domain of an email address for a mention', async () => {
    await render(<ParsedText text="reach me at jane@example.com anytime" />);

    expect(screen.queryByText('@example')).toBeNull();
    expect(screen.getByText('reach me at jane@example.com anytime')).toBeTruthy();
  });

  it('still linkifies a mention that opens the body', async () => {
    await render(<ParsedText text="@jane hello" />);

    await fireEvent.press(screen.getByText('@jane'));

    expect(__mockRouter.push).toHaveBeenCalledWith('/user/jane');
  });

  it('leaves an @ inside a URL to the URL', async () => {
    await render(<ParsedText text="see https://example.com/@jane for more" />);

    expect(screen.getByText('https://example.com/@jane')).toBeTruthy();
    expect(screen.queryByText('@jane')).toBeNull();
  });

  it('keeps the punctuation in front of a mention as prose', async () => {
    await render(<ParsedText text="(@jane)" />);

    expect(screen.getByText('@jane')).toBeTruthy();
    expect(screen.getByText('(')).toBeTruthy();
  });

  it('renders an empty body without crashing', async () => {
    const result = await render(<ParsedText text="" />);
    expect(result.toJSON()).toBeTruthy();
  });
});
