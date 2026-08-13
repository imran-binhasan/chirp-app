import { asyncHandler } from '../../common/async-handler';
import { sendSuccess } from '../../common/response';
import * as devicesService from './devices.service';
import type { DeviceTokenParams, RegisterDeviceInput } from './devices.validation';

export const registerDevice = asyncHandler(async (req, res) => {
  const device = await devicesService.registerDevice(req.user!.id, req.body as RegisterDeviceInput);
  sendSuccess(res, device);
});

export const unregisterDevice = asyncHandler(async (req, res) => {
  const { token } = req.params as unknown as DeviceTokenParams;
  await devicesService.unregisterDevice(req.user!.id, token);
  sendSuccess(res, { message: 'Device unregistered' });
});
