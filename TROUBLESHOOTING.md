# Troubleshooting npm Install Issues

## Current Issue: EPERM Error with npm

If you're seeing permission errors like:
```
npm error code EPERM
npm error path /Users/gerard/.nvm/versions/node/v22.14.0/lib/node_modules/npm/...
```

This is a system-level npm/nvm permission issue, not a problem with this plugin's dependencies.

## Solutions

### Option 1: Fix npm Permissions (Recommended)

1. **Reinstall npm via nvm:**
   ```bash
   nvm reinstall-packages $(nvm current)
   ```

2. **Or reinstall the current Node version:**
   ```bash
   nvm uninstall v22.14.0
   nvm install v22.14.0
   ```

3. **Fix permissions on nvm directory:**
   ```bash
   sudo chown -R $(whoami) ~/.nvm
   ```

### Option 2: Use a Different Node Version

Try using a different Node.js version:
```bash
nvm install 20
nvm use 20
npm install
```

### Option 3: Use Yarn or pnpm

If npm continues to have issues, try an alternative package manager:

**With Yarn:**
```bash
npm install -g yarn
yarn install
```

**With pnpm:**
```bash
npm install -g pnpm
pnpm install
```

### Option 4: Use npm with --legacy-peer-deps

Sometimes this helps with dependency resolution:
```bash
npm install --legacy-peer-deps
```

### Option 5: Clear npm Cache

Clear npm cache and try again:
```bash
npm cache clean --force
npm install
```

## Verify Installation

After successful installation, verify the build works:

```bash
npm run build
```

This should:
1. Clean the dist folder
2. Compile TypeScript
3. Bundle with Rollup

## Manual Verification

If you can't install dependencies, you can still verify the code structure:

1. **Check TypeScript syntax** (if you have tsc globally):
   ```bash
   tsc --noEmit --skipLibCheck src/**/*.ts
   ```

2. **Verify file structure:**
   - ✅ `src/` contains all TypeScript files
   - ✅ `android/` contains Kotlin implementation
   - ✅ `ios/Plugin/` contains Swift implementation
   - ✅ `package.json` has correct dependencies

## Dependencies Summary

The plugin requires:
- `@capacitor/core`: ^7.0.0
- TypeScript: ^5.7.2
- Rollup: ^4.28.0
- Various build tools (see package.json)

All dependencies are up-to-date and compatible with Capacitor 7.

