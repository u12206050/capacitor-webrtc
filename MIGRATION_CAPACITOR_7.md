# Migration to Capacitor 7

This plugin has been updated to support Capacitor 7.0+.

## Changes Made

### Dependencies
- Updated `@capacitor/core` from ^5.0.0 to ^7.0.0
- Updated `@capacitor/android` from ^5.0.0 to ^7.0.0
- Updated `@capacitor/ios` from ^5.0.0 to ^7.0.0
- Updated `@capacitor/cli` from ^5.0.0 to ^7.0.0

### Android
- **Minimum SDK**: Updated from API 22 to API 23 (Android 6.0+)
- **Compile SDK**: Updated from 33 to 35
- **Target SDK**: Updated from 33 to 35
- **Gradle**: Updated to 8.7.0

### iOS
- **Deployment Target**: Updated from iOS 13.0 to iOS 14.0

## Breaking Changes

If you're upgrading from a Capacitor 5 version of this plugin:

1. **Update your app's Capacitor version**:
   ```bash
   npm install @capacitor/core@^7.0.0 @capacitor/cli@^7.0.0
   npm install @capacitor/android@^7.0.0 @capacitor/ios@^7.0.0
   ```

2. **Run Capacitor migration**:
   ```bash
   npx cap migrate
   ```

3. **Update Android minimum SDK**:
   - Ensure your app's `minSdkVersion` is at least 23

4. **Update iOS deployment target**:
   - Set iOS Deployment Target to 14.0 in Xcode
   - Update your Podfile: `platform :ios, '14.0'`

5. **Sync native projects**:
   ```bash
   npx cap sync
   ```

## Compatibility

- ✅ Capacitor 7.0+
- ❌ Capacitor 5.x (not supported)
- ❌ Capacitor 6.x (not tested, may work but not officially supported)

## Testing

After migration, test the following:
- [ ] WebRTC connection establishment
- [ ] Audio/video capture and playback
- [ ] DataChannel communication
- [ ] Background audio (iOS/Android)
- [ ] Camera switching
- [ ] Track enable/disable

