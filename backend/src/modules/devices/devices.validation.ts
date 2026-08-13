import { z } from 'zod';
import { trimmedString } from '../../common/validation-utils';

export const registerDeviceSchema = z.object({
  token: trimmedString(4096, 10),
  platform: z.enum(['android', 'ios', 'web']),
});

export const deviceTokenParamsSchema = z.object({
  token: z.string().min(1).max(4096),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type DeviceTokenParams = z.infer<typeof deviceTokenParamsSchema>;
