/**
 * Example usage of getUserMedia in the WebRTC Receiver plugin
 * This enables sending local camera/microphone to remote peers
 */

import { CapWebRTC } from './src/index';

// Get user media (camera and microphone)
async function startLocalMedia() {
  const { tracks } = await CapWebRTC.getUserMedia({
    audio: true,
    video: true,
    facingMode: 'user', // 'user' = front camera, 'environment' = back camera
  });
  
  console.log('Got tracks:', tracks);
  // tracks: [{ trackId: '...', kind: 'audio'|'video', enabled: true, muted: false }]
  
  // Add tracks to peer connection
  for (const track of tracks) {
    await CapWebRTC.addTrack(track.trackId);
  }
  
  return tracks;
}

// Create an offer (initiate connection)
async function initiateCall() {
  await CapWebRTC.start({
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  });
  
  // Get local media
  const tracks = await startLocalMedia();
  
  // Create offer
  const offer = await CapWebRTC.createOffer();
  console.log('Created offer:', offer);
  
  // Send offer to remote peer via signaling
  signalingSend({ type: 'offer', offer });
  
  // Wait for answer
  const answer = await waitForRemoteAnswer();
  await CapWebRTC.setRemoteDescription(answer);
  
  // Add ICE candidates as they arrive
  // ...
}

// Switch between front and back camera
async function switchCamera() {
  await CapWebRTC.switchCamera();
}

// Enable/disable tracks
async function toggleAudio() {
  const tracks = await CapWebRTC.getTracks();
  const audioTrack = tracks.tracks.find(t => t.kind === 'audio');
  
  if (audioTrack) {
    await CapWebRTC.setTrackEnabled({
      trackId: audioTrack.trackId,
      enabled: !audioTrack.enabled,
    });
  }
}

// Get available devices
async function listDevices() {
  const audioDevices = await CapWebRTC.getAudioInputDevices();
  const videoDevices = await CapWebRTC.getVideoInputDevices();
  
  console.log('Audio devices:', audioDevices.devices);
  console.log('Video devices:', videoDevices.devices);
}

// Use specific device
async function useSpecificCamera() {
  const { devices } = await CapWebRTC.getVideoInputDevices();
  const backCamera = devices.find(d => d.label.includes('Back'));
  
  if (backCamera) {
    const { tracks } = await CapWebRTC.getUserMedia({
      video: true,
      videoDeviceId: backCamera.deviceId,
    });
    
    await CapWebRTC.addTrack(tracks[0].trackId);
  }
}

// Placeholder functions
function signalingSend(data: any) {
  console.log('Sending to signaling:', data);
}

async function waitForRemoteAnswer(): Promise<{ type: 'answer'; sdp: string }> {
  return { type: 'answer', sdp: '' };
}

