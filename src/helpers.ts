import type { CapWebRTCPlugin } from './definitions';

// Lazy getter for the plugin instance to avoid circular dependency with index.ts
// The plugin is registered in index.ts, and we import it lazily when needed
let pluginInstance: CapWebRTCPlugin | null = null;

const getCapWebRTC = async (): Promise<CapWebRTCPlugin> => {
  if (!pluginInstance) {
    // Dynamic import to avoid circular dependency - by the time this runs,
    // index.ts will have already registered the plugin
    const module = await import('./index');
    pluginInstance = module.CapWebRTC;
  }
  return pluginInstance;
};

export async function attachNativeVideoToElement(
  el: HTMLElement,
  opts?: { mode?: 'fit' | 'fill' }
): Promise<{ viewId: string; refresh: () => Promise<void>; destroy: () => Promise<void> }> {
  const plugin = await getCapWebRTC();
  const rect = el.getBoundingClientRect();

  // Capacitor coordinates are in CSS pixels; on iOS you may need to account for safe areas;
  // this is "good enough" for most apps and can be refined.
  const { viewId } = await plugin.createVideoView({
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    mode: opts?.mode ?? 'fit',
  });

  const refresh = async () => {
    const r = el.getBoundingClientRect();
    const p = await getCapWebRTC();
    await p.updateVideoView({
      viewId,
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
  };

  const destroy = async () => {
    const p = await getCapWebRTC();
    await p.destroyVideoView({ viewId });
  };

  return { viewId, refresh, destroy };
}

