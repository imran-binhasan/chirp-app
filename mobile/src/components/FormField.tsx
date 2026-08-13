import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useThemeColors } from '../utils/theme';

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Server-side message for this field, e.g. "Username is already taken". */
  serverError?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'username' | 'email' | 'password' | 'new-password' | 'off';
}

/**
 * One labelled, validated input. Login and signup were ~90 duplicated lines of
 * markup per field before this existed.
 */
export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  icon,
  serverError,
  secure = false,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete = 'off',
}: FormFieldProps<T>) {
  const theme = useThemeColors();
  const [revealed, setRevealed] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error, isTouched } }) => {
        // Server errors outrank client ones: they reflect the latest attempt.
        const message = serverError ?? (isTouched ? error?.message : undefined);
        const invalid = Boolean(message);

        return (
          <View style={styles.group}>
            <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
            <View
              style={[
                styles.wrapper,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: invalid ? theme.danger : theme.border,
                },
              ]}
            >
              <Ionicons name={icon} size={20} color={theme.textSecondary} style={styles.icon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={placeholder}
                placeholderTextColor={theme.textSecondary}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={secure && !revealed}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                autoComplete={autoComplete}
                autoCorrect={false}
                accessibilityLabel={label}
                accessibilityHint={message}
                testID={`field-${String(name)}`}
              />
              {secure ? (
                <TouchableOpacity
                  onPress={() => setRevealed((shown) => !shown)}
                  style={styles.reveal}
                  accessibilityRole="button"
                  accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                >
                  <Ionicons
                    name={revealed ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
            {message ? (
              <Text style={[styles.error, { color: theme.danger }]} testID={`error-${String(name)}`}>
                {message}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontFamily: 'Outfit_500Medium', fontSize: 14, marginLeft: 4 },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  icon: { marginRight: 12 },
  input: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 16, height: '100%' },
  reveal: { padding: 4 },
  error: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginLeft: 4 },
});
