import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import * as devicesService from './devices.service';
import type { RegisterDeviceInput, UnregisterDeviceInput } from './devices.validation';

export const registerDevice = asyncHandler(async (req, res) => {
  const device = await devicesService.registerDevice(req.user!.id, req.body as RegisterDeviceInput);
  sendSuccess(res, device);
});

export const unregisterDevice = asyncHandler(async (req, res) => {
  const { token } = req.body as UnregisterDeviceInput;
  await devicesService.unregisterDevice(req.user!.id, token);
  sendSuccess(res, { message: 'Device unregistered' });
});
