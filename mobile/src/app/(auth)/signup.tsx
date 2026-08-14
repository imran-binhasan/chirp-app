import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../store/AuthContext';
import { authApi } from '../../api/endpoints';
import { ApiError, toApiError } from '../../api/errors';
import { AuthScreen } from '../../components/AuthScreen';
import { FormField } from '../../components/FormField';

// Mirrors backend/src/modules/auth/auth.validation.ts.
const signupSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
  email: z.email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const [serverErrors, setServerErrors] = useState<ApiError>();

  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: { username: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    setServerErrors(undefined);
    try {
      const { user, tokens } = await authApi.signup(values);
      await login(tokens.accessToken, tokens.refreshToken, user);
      router.replace('/(main)/feed');
    } catch (error) {
      const apiError = toApiError(error);
      setServerErrors(apiError);

      // Only show the banner when the error maps onto no input.
      const mapsToField =
        apiError.fieldErrors.length > 0 ||
        (apiError.code === 'CONFLICT' && /username|email/i.test(apiError.message));
      if (!mapsToField) setFormError(apiError.message);
    }
  });

  const conflictFor = (field: 'username' | 'email'): string | undefined => {
    if (!serverErrors) return undefined;
    const fieldError = serverErrors.fieldError(field);
    if (fieldError) return fieldError;
    if (serverErrors.code === 'CONFLICT' && serverErrors.message.toLowerCase().includes(field)) {
      return serverErrors.message;
    }
    return undefined;
  };

  return (
    <AuthScreen
      title="Create account"
      subtitle="Join the community today."
      formError={formError}
      submitLabel="Sign up"
      submittingLabel="Signing up…"
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      disabled={!isValid}
      footerPrompt="Already have an account?"
      footerAction="Log in"
      onFooterPress={() => router.push('/(auth)/login')}
    >
      <FormField
        control={control}
        name="username"
        label="Username"
        placeholder="Pick a username"
        icon="person-outline"
        serverError={conflictFor('username')}
        autoComplete="username"
      />
      <FormField
        control={control}
        name="email"
        label="Email address"
        placeholder="Enter your email"
        icon="mail-outline"
        serverError={conflictFor('email')}
        keyboardType="email-address"
        autoComplete="email"
      />
      <FormField
        control={control}
        name="password"
        label="Password"
        placeholder="Create a password"
        icon="lock-closed-outline"
        secure
        autoComplete="new-password"
      />
    </AuthScreen>
  );
}
