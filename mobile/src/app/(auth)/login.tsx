import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../store/AuthContext';
import { authApi } from '../../api/endpoints';
import { toApiError } from '../../api/errors';
import { AuthScreen } from '../../components/AuthScreen';
import { FormField } from '../../components/FormField';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();

  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      const { user, tokens } = await authApi.login(values);
      await login(tokens.accessToken, tokens.refreshToken, user);
      router.replace('/(main)/feed');
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Log in to continue to Chirp."
      formError={formError}
      submitLabel="Log in"
      submittingLabel="Logging in…"
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      disabled={!isValid}
      footerPrompt="Don't have an account?"
      footerAction="Sign up"
      onFooterPress={() => router.push('/(auth)/signup')}
    >
      <FormField
        control={control}
        name="identifier"
        label="Email or username"
        placeholder="Enter your email or username"
        icon="person-outline"
        autoComplete="username"
      />
      <FormField
        control={control}
        name="password"
        label="Password"
        placeholder="Enter your password"
        icon="lock-closed-outline"
        secure
        autoComplete="password"
      />
    </AuthScreen>
  );
}
