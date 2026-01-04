# Pre-Publish Checklist

## Critical Issues (Must Fix Before Publishing)

### 1. package.json Metadata
- [ ] **Author field is empty** - Add your name/email
- [ ] **Repository URL is empty** - Add your GitHub/GitLab repo URL
- [ ] **Bugs URL is empty** - Add issues URL (usually `{repo}/issues`)
- [ ] **Description is outdated** - Currently says "receive-only" but plugin now supports full-duplex
- [ ] **Keywords** - Consider adding: "datachannel", "getusermedia", "videocall", "audiocall"

### 2. License File
- [ ] **Missing LICENSE file** - Create `LICENSE` file with MIT license text
- [ ] Package.json references MIT but no file exists

### 3. Build Verification
- [ ] **Test build** - Run `npm run build` to ensure it compiles
- [ ] **Verify dist/ output** - Check that dist/esm/ and dist/plugin.js are generated
- [ ] **TypeScript compilation** - Ensure no type errors

### 4. iOS Podspec Issues
- [ ] **Root podspec references empty repository** - Will fail if repo URL is empty
- [ ] **iOS Plugin.podspec** - References parent package.json correctly (good)

## Important (Should Fix)

### 5. Documentation
- [ ] **CHANGELOG.md** - Create changelog for v0.0.1
- [ ] **README.md** - Add "Requirements" section (Capacitor 5+, iOS 13+, Android API 22+)
- [ ] **README.md** - Add "Troubleshooting" section
- [ ] **README.md** - Add "Contributing" section (optional but nice)
- [ ] **README.md** - Update description to match package.json

### 6. Example Files
- [ ] **Example files in .npmignore** - Consider keeping them or moving to `/examples` folder
- [ ] **Create proper examples directory** - Or document that examples are in root

### 7. Version & Publishing
- [ ] **Version number** - 0.0.1 is good for initial release
- [ ] **npm publish access** - Ensure you have npm account and package name is available
- [ ] **Test publish to npm** - Consider using `npm publish --dry-run` first

## Nice to Have (Optional)

### 8. Testing
- [ ] **Unit tests** - Not critical for initial release but good to have
- [ ] **Integration tests** - Test on real devices

### 9. CI/CD
- [ ] **GitHub Actions** - Set up automated builds/tests
- [ ] **Automated versioning** - Consider semantic-release

### 10. Code Quality
- [ ] **Run linter** - `npm run lint` (if configured)
- [ ] **Code review** - Have someone review the native code
- [ ] **Error handling** - Review error messages for clarity

## Recommended Fixes

Here are the specific fixes I recommend:

1. **Update package.json description:**
   ```json
   "description": "Capacitor plugin for WebRTC support with native video rendering. Supports bidirectional audio/video communication, data channels, and background audio."
   ```

2. **Add repository info** (replace with your actual repo):
   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/yourusername/capacitor-webrtc.git"
   },
   "bugs": {
     "url": "https://github.com/yourusername/capacitor-webrtc/issues"
   }
   ```

3. **Create LICENSE file** - Standard MIT license text

4. **Test the build:**
   ```bash
   npm run build
   ```

5. **Verify exports** - Check that all public APIs are exported correctly

## Before Publishing

1. ✅ Run `npm run build` successfully
2. ✅ Test on iOS device/simulator
3. ✅ Test on Android device/emulator
4. ✅ Verify all permissions are documented
5. ✅ Check that example code in README works
6. ✅ Ensure .npmignore excludes development files
7. ✅ Verify package.json files array includes everything needed

## Publishing Command

Once ready:
```bash
npm publish --access public
```

Or if scoped:
```bash
npm publish
```

