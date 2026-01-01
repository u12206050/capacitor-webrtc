# Integration Guide

## Android Setup

1. **Add WebRTC dependency**: The plugin's `build.gradle` already includes the WebRTC library:
   ```gradle
   implementation "org.webrtc:google-webrtc:1.0.32006"
   ```

2. **Permissions**: The AndroidManifest.xml includes the necessary permissions:
   - `FOREGROUND_SERVICE`
   - `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
   - `INTERNET`
   - `RECORD_AUDIO`
   - `CAMERA`

3. **Foreground Service**: The plugin uses a foreground service (`WebRTCFgService`) to keep audio alive in the background. This is automatically started when `enableBackgroundAudio` is true.

## iOS Setup

1. **Add WebRTC via CocoaPods**: The plugin's Podspec includes:
   ```ruby
   s.dependency 'GoogleWebRTC', '~> 1.1'
   ```
   Run `pod install` in your iOS app directory.

2. **Enable Background Audio**: In Xcode:
   - Go to **Signing & Capabilities**
   - Add **Background Modes**
   - Check:
     - ✅ Audio, AirPlay, and Picture in Picture
     - ✅ Background fetch (optional)

3. **Info.plist**: Add camera and microphone usage descriptions:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>This app needs camera access for video calls</string>
   <key>NSMicrophoneUsageDescription</key>
   <string>This app needs microphone access for audio calls</string>
   ```

## Usage

See `example-usage.ts` for a complete example of how to use the plugin.

### Key Points:

1. **Video View Management**: Use `attachNativeVideoToElement()` helper to attach native video to a DOM element. The helper automatically handles positioning and updates on resize/scroll.

2. **Signaling**: Keep your signaling logic in JavaScript. The plugin handles the WebRTC peer connection, but you manage offer/answer/ICE exchange.

3. **Background Behavior**:
   - Audio continues playing when app is backgrounded
   - Video rendering pauses when backgrounded and resumes on foreground
   - A/V stays synced because the PeerConnection stays alive

4. **Layout Changes**: Call `refresh()` on the view handle when layout changes (window resize, scroll, route changes, etc.)

## Troubleshooting

### Android
- If audio stops in background, ensure the foreground service notification is visible
- Check that `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission is granted
- Verify WebRTC library version compatibility

### iOS
- Background audio requires the Background Modes capability to be enabled
- Ensure `AVAudioSession` is configured correctly (done automatically by the plugin)
- Check that camera/microphone permissions are granted

