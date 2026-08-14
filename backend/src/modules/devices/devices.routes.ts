import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import { validate } from '../../common/middleware/validate';
import * as controller from './devices.controller';
import { registerDeviceSchema, unregisterDeviceSchema } from './devices.validation';

export const devicesRouter = Router();

devicesRouter.use(authenticate);

devicesRouter.post('/', validate({ body: registerDeviceSchema }), controller.registerDevice);
devicesRouter.delete('/', validate({ body: unregisterDeviceSchema }), controller.unregisterDevice);
