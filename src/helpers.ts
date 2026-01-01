import { WebRTCReceiver } from './index';

export async function attachNativeVideoToElement(
  el: HTMLElement,
  opts?: { mode?: 'fit' | 'fill' }
): Promise<{ viewId: string; refresh: () => Promise<void>; destroy: () => Promise<void> }> {
  const rect = el.getBoundingClientRect();

  // Capacitor coordinates are in CSS pixels; on iOS you may need to account for safe areas;
  // this is "good enough" for most apps and can be refined.
  const { viewId } = await WebRTCReceiver.createVideoView({
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    mode: opts?.mode ?? 'fit',
  });

  const refresh = async () => {
    const r = el.getBoundingClientRect();
    await WebRTCReceiver.updateVideoView({
      viewId,
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
  };

  const destroy = async () => {
    await WebRTCReceiver.destroyVideoView({ viewId });
  };

  return { viewId, refresh, destroy };
}

