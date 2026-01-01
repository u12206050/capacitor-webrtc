import { registerPlugin } from '@capacitor/core';
import type { WebRTCReceiverPlugin } from './definitions';

export const WebRTCReceiver = registerPlugin<WebRTCReceiverPlugin>('WebRTCReceiver', {
  web: () => import('./web').then(m => new m.WebRTCReceiverWeb()),
});

export * from './definitions';
export * from './helpers';

