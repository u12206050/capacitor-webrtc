/**
 * Example usage of the WebRTC Receiver plugin
 * 
 * This example assumes you already have signaling (WebSocket, etc.) that delivers:
 * - remote offer
 * - remote ice candidates
 * 
 * ...and you send back:
 * - answer
 * - local ice candidates
 */

import { attachNativeVideoToElement } from './src/helpers';
import { WebRTCReceiver } from './src/index';

let viewHandle: Awaited<ReturnType<typeof attachNativeVideoToElement>> | null = null;

// Listen for plugin events (we'll emit "iceCandidate" and "connectionState" from native)
WebRTCReceiver.addListener('iceCandidate', (cand) => {
  // send cand to your signaling server
  signalingSend({ type: 'ice', cand });
});

WebRTCReceiver.addListener('connectionState', (ev) => {
  console.log('connectionState', ev);
});

async function start() {
  const remoteDiv = document.getElementById('remoteVideo')!;
  viewHandle = await attachNativeVideoToElement(remoteDiv, { mode: 'fit' });

  // Keep overlay aligned if layout changes
  window.addEventListener('resize', () => viewHandle?.refresh());
  window.addEventListener('scroll', () => viewHandle?.refresh(), { passive: true });

  await WebRTCReceiver.start({
    enableBackgroundAudio: true,
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  });

  // 1) Get remote offer from your signaling
  const offer = await waitForRemoteOffer();
  await WebRTCReceiver.setRemoteDescription(offer);

  // 2) Create answer and send it back
  const answer = await WebRTCReceiver.createAnswer();
  signalingSend({ type: 'answer', answer });

  // 3) As remote ICE arrives:
  // await WebRTCReceiver.addIceCandidate(cand)
}

async function stop() {
  await viewHandle?.destroy();
  viewHandle = null;
  await WebRTCReceiver.stop();
}

// wire up buttons
document.getElementById('start')!.addEventListener('click', start);
document.getElementById('stop')!.addEventListener('click', stop);

// Example: handle signaling messages
function onSignalingMessage(msg: any) {
  if (msg.type === 'offer') WebRTCReceiver.setRemoteDescription(msg.offer);
  if (msg.type === 'ice') WebRTCReceiver.addIceCandidate(msg.cand);
}

// Placeholder functions (implement based on your signaling mechanism)
function signalingSend(data: any) {
  // Send to your WebSocket or signaling server
  console.log('Sending to signaling:', data);
}

async function waitForRemoteOffer(): Promise<{ type: 'offer'; sdp: string }> {
  // Wait for and return the remote offer from your signaling
  return { type: 'offer', sdp: '' };
}

