import { registerPlugin } from '@capacitor/core';

import type { CapWebRTCPlugin } from './definitions';

export const CapWebRTC = registerPlugin<CapWebRTCPlugin>('CapWebRTC', {
  web: () => import('./web').then(m => new m.CapWebRTCWeb()),
});

export * from './definitions';
export * from './helpers';

