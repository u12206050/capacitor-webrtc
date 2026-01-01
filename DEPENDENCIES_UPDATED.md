# Dependencies Updated

All dependencies have been updated to their latest compatible versions for Capacitor 7.

## Updated Dependencies

### Core Dependencies
- `@capacitor/core`: ^7.0.0 (latest Capacitor 7)
- `@capacitor/android`: ^7.0.0
- `@capacitor/ios`: ^7.0.0
- `@capacitor/cli`: ^7.0.0

### Build Tools
- `typescript`: ~5.0.0 → ^5.7.2 (latest TypeScript 5.x)
- `rollup`: ^3.0.0 → ^4.28.0 (latest Rollup 4.x)
- `@rollup/plugin-node-resolve`: ^15.0.0 → ^15.2.3
- `@rollup/plugin-typescript`: ^11.0.0 → ^12.1.1

### Code Quality
- `prettier`: ^3.0.0 → ^3.4.2
- `prettier-plugin-java`: ^2.0.0 → ^2.4.0
- `rimraf`: ^5.0.0 → ^6.0.1

### TypeScript Configuration Updates
- Updated `target` from ES2017 to ES2022
- Updated `lib` to include ES2022
- Updated `moduleResolution` from "node" to "bundler" (modern standard)
- Added `allowSyntheticDefaultImports` for better compatibility

### Rollup Configuration Updates
- Added proper TypeScript plugin configuration
- Added browser option for node-resolve plugin
- Improved declaration file generation

### Android Build Updates
- Gradle: 8.0.0 → 8.7.0
- Compile SDK: 33 → 35
- Target SDK: 33 → 35
- Min SDK: 22 → 23

### iOS Updates
- Deployment target: iOS 13.0 → iOS 14.0

## Installation

Run the following to install all updated dependencies:

```bash
npm install
```

## Testing

After installation, test the build:

```bash
npm run build
```

This will:
1. Clean the dist folder
2. Generate documentation
3. Compile TypeScript
4. Bundle with Rollup

## Compatibility

All dependencies are compatible with:
- ✅ Node.js 18+
- ✅ Capacitor 7.0+
- ✅ Modern build tools
- ✅ Latest TypeScript features

