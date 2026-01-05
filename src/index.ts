import { registerPlugin } from '@capacitor/core';

import type { CapWebRTCPlugin } from './definitions';
import { CapWebRTCWeb } from './web';

export const CapWebRTC = registerPlugin<CapWebRTCPlugin>('CapWebRTC', {
  web: () => new CapWebRTCWeb(),
});

export * from './definitions';
export * from './helpers';

