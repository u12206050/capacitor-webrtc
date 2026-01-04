# capacitor-webrtc

Capacitor plugin for WebRTC support with native video rendering. Supports both sending and receiving media.

## Features

- **Cross-platform WebRTC**: Works on Web, Android, and iOS
- Native WebRTC implementation (Android + iOS)
- Browser WebRTC API implementation (Web)
- JavaScript-based signaling (pass offer/ICE in, get answer/ICE out)
- Native video overlay rendering over WebView (mobile)
- HTML5 video element rendering (web)
- Background audio support (iOS background audio + Android foreground service)
- Video pause/resume on background/foreground transitions
- DataChannel support for bidirectional data exchange
- **User Media Support**: Capture and send camera/microphone (getUserMedia equivalent)
- **Full-duplex communication**: Send and receive audio/video simultaneously

## Installation

```bash
npm install capacitor-webrtc
npx cap sync
```

## Usage

```typescript
import { WebRTCReceiver } from 'capacitor-webrtc';
import { attachNativeVideoToElement } from 'capacitor-webrtc/dist/esm/helpers';

// Listen for plugin events
WebRTCReceiver.addListener('iceCandidate', (cand) => {
  // Send candidate to your signaling server
  signalingSend({ type: 'ice', cand });
});

WebRTCReceiver.addListener('connectionState', (ev) => {
  console.log('connectionState', ev);
});

// Start WebRTC session
const remoteDiv = document.getElementById('remoteVideo')!;
const viewHandle = await attachNativeVideoToElement(remoteDiv, { mode: 'fit' });

await WebRTCReceiver.start({
  enableBackgroundAudio: true,
  iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
});

// Set remote offer
const offer = await waitForRemoteOffer();
await WebRTCReceiver.setRemoteDescription(offer);

// Create answer
const answer = await WebRTCReceiver.createAnswer();
signalingSend({ type: 'answer', answer });

// Add ICE candidates as they arrive
await WebRTCReceiver.addIceCandidate(cand);

// DataChannel support
WebRTCReceiver.addListener('dataChannel', (event) => {
  console.log('Data channel opened:', event.channelId);
});

WebRTCReceiver.addListener('dataChannelMessage', (event) => {
  if (event.binary) {
    // Binary data (base64 encoded)
    const data = atob(event.data);
  } else {
    // Text data
    console.log('Message:', event.data);
  }
});

// Create a data channel
const { channelId } = await WebRTCReceiver.createDataChannel({
  label: 'my-channel',
  ordered: true,
});

// Send data
await WebRTCReceiver.sendData({
  channelId,
  data: 'Hello!',
  binary: false,
});

// User Media Support - Send local camera/microphone
const { tracks } = await WebRTCReceiver.getUserMedia({
  audio: true,
  video: true,
  facingMode: 'user', // 'user' = front, 'environment' = back
});

// Add tracks to peer connection
for (const track of tracks) {
  await WebRTCReceiver.addTrack(track.trackId);
}

// Create offer to initiate connection
const offer = await WebRTCReceiver.createOffer();
signalingSend({ type: 'offer', offer });

// Switch camera
await WebRTCReceiver.switchCamera();

// Enable/disable tracks
await WebRTCReceiver.setTrackEnabled({
  trackId: tracks[0].trackId,
  enabled: false, // mute
});

// Stop session
await viewHandle.destroy();
await WebRTCReceiver.stop();
```

## Requirements

- Capacitor 7.0+
- **Web**: Modern browsers with WebRTC support (Chrome, Firefox, Safari, Edge)
- **iOS**: iOS 14.0+
- **Android**: API 23+ (Android 6.0+)

## Permissions

### Android
The plugin automatically requests these permissions:
- `INTERNET` - For WebRTC connections
- `RECORD_AUDIO` - For microphone access
- `CAMERA` - For camera access
- `FOREGROUND_SERVICE` - For background audio
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK` - For background audio playback

### iOS
Add these to your `Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>This app needs camera access for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access for audio calls</string>
```

Enable Background Modes in Xcode:
- Audio, AirPlay, and Picture in Picture

## API

See the TypeScript definitions in `src/definitions.ts` for full API documentation.

## Troubleshooting

### Web
- **getUserMedia fails**: Ensure HTTPS (or localhost) - browsers require secure context
- **Video not displaying**: Check browser console for errors
- **DataChannel not working**: Verify both peers support data channels

### Android
- **Audio stops in background**: Ensure foreground service notification is visible
- **Camera not working**: Check that CAMERA permission is granted at runtime
- **WebRTC connection fails**: Verify STUN/TURN servers are accessible

### iOS
- **Background audio not working**: Ensure Background Modes capability is enabled
- **Camera permission denied**: Check Info.plist has NSCameraUsageDescription
- **Build errors**: Run `pod install` in your iOS app directory

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a list of changes.

