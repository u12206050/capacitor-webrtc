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
import { CapWebRTC } from './src/index';

let viewHandle: Awaited<ReturnType<typeof attachNativeVideoToElement>> | null = null;

// Listen for plugin events (we'll emit "iceCandidate" and "connectionState" from native)
CapWebRTC.addListener('iceCandidate', (cand) => {
  // send cand to your signaling server
  signalingSend({ type: 'ice', cand });
});

CapWebRTC.addListener('connectionState', (ev) => {
  console.log('connectionState', ev);
});

async function start() {
  const remoteDiv = document.getElementById('remoteVideo')!;
  viewHandle = await attachNativeVideoToElement(CapWebRTC, remoteDiv, { mode: 'fit' });

  // Keep overlay aligned if layout changes
  window.addEventListener('resize', () => viewHandle?.refresh());
  window.addEventListener('scroll', () => viewHandle?.refresh(), { passive: true });

  await CapWebRTC.start({
    enableBackgroundAudio: true,
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  });

  // 1) Get remote offer from your signaling
  const offer = await waitForRemoteOffer();
  await CapWebRTC.setRemoteDescription(offer);

  // 2) Create answer and send it back
  const answer = await CapWebRTC.createAnswer();
  signalingSend({ type: 'answer', answer });

  // 3) As remote ICE arrives:
  // await CapWebRTC.addIceCandidate(cand)
}

async function stop() {
  await viewHandle?.destroy();
  viewHandle = null;
  await CapWebRTC.stop();
}

// wire up buttons
document.getElementById('start')!.addEventListener('click', start);
document.getElementById('stop')!.addEventListener('click', stop);

// Example: handle signaling messages
function onSignalingMessage(msg: any) {
  if (msg.type === 'offer') CapWebRTC.setRemoteDescription(msg.offer);
  if (msg.type === 'ice') CapWebRTC.addIceCandidate(msg.cand);
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

