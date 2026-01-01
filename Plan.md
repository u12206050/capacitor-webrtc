Below is a simple, receive-only WebRTC Capacitor plugin scaffold that:
	•	Runs WebRTC natively (Android + iOS)
	•	Lets your app do signaling in JS (you pass offer/ICE in, you get answer/ICE out)
	•	Renders remote video in a native view over the WebView (like camera-preview plugins)
	•	Keeps audio playing when minimized / screen off (production approach: iOS background-audio + Android foreground service)
	•	Pauses video rendering when backgrounded and resumes on foreground (audio continues)

“Nice to have: native player video when minimized”
Reality: true background/PiP video for WebRTC is non-trivial (especially iOS). I’ll include a clean hook/stub for PiP later (Android PiP Activity is feasible; iOS PiP with WebRTC requires sample-buffer PiP plumbing). You can still get “solid” background audio + video resume in sync.

⸻

1) Plugin API (TypeScript)

src/definitions.ts

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export interface StartOptions {
  iceServers?: IceServer[];
  // If your remote offer uses specific codecs/transports, you can add knobs here later
  enableBackgroundAudio?: boolean; // default true
}

export interface SdpDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface IceCandidate {
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
}

export interface CreateVideoViewOptions {
  // pixel coords relative to screen
  x: number;
  y: number;
  width: number;
  height: number;
  mode?: 'fit' | 'fill'; // default 'fit'
}

export interface UpdateVideoViewOptions extends Partial<CreateVideoViewOptions> {}

export interface WebRTCReceiverPlugin {
  start(options?: StartOptions): Promise<void>;
  stop(): Promise<void>;

  setRemoteDescription(desc: SdpDescription): Promise<void>;
  createAnswer(): Promise<SdpDescription>;
  addIceCandidate(cand: IceCandidate): Promise<void>;

  // Native video overlay view management
  createVideoView(options: CreateVideoViewOptions): Promise<{ viewId: string }>;
  updateVideoView(options: UpdateVideoViewOptions & { viewId: string }): Promise<void>;
  destroyVideoView(options: { viewId: string }): Promise<void>;

  // Optional: speaker / routing controls (useful for receive-only)
  setSpeakerphoneOn(options: { on: boolean }): Promise<void>;
}

src/index.ts

import { registerPlugin } from '@capacitor/core';
import type { WebRTCReceiverPlugin } from './definitions';

export const WebRTCReceiver = registerPlugin<WebRTCReceiverPlugin>('WebRTCReceiver');
export * from './definitions';

src/helpers.ts (easy “attach to DOM element” helper)

import { WebRTCReceiver } from './index';

export async function attachNativeVideoToElement(
  el: HTMLElement,
  opts?: { mode?: 'fit' | 'fill' }
): Promise<{ viewId: string; refresh: () => Promise<void>; destroy: () => Promise<void> }> {
  const rect = el.getBoundingClientRect();

  // Capacitor coordinates are in CSS pixels; on iOS you may need to account for safe areas;
  // this is “good enough” for most apps and can be refined.
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


⸻

2) JS usage example (shows video in the WebView)

This example assumes you already have signaling (WebSocket, etc.) that delivers:
	•	remote offer
	•	remote ice candidates

…and you send back:
	•	answer
	•	local ice candidates

Example UI (React/Vue/Vanilla works the same)

<div id="remoteVideo" style="width: 100%; height: 240px; background: #000;"></div>
<button id="start">Start</button>
<button id="stop">Stop</button>

Example code

import { WebRTCReceiver } from 'capacitor-webrtc-receiver';
import { attachNativeVideoToElement } from 'capacitor-webrtc-receiver/dist/esm/helpers';

let viewHandle: Awaited<ReturnType<typeof attachNativeVideoToElement>> | null = null;

// Listen for plugin events (we’ll emit “iceCandidate” and “connectionState” from native)
WebRTCReceiver.addListener('iceCandidate', (cand) => {
  // send cand to your signaling server
  signalingSend({ type: 'ice', cand });
});

WebRTCReceiver.addListener('connectionState', (ev) => {
  console.log('connectionState', ev);
});

async function start() {
  const remoteDiv = document.getElementById('remoteVideo')!;
  viewHandle = await attachNativeVideoToElement(remoteDiv, { mode: 'fit' });

  // Keep overlay aligned if layout changes
  window.addEventListener('resize', () => viewHandle?.refresh());
  window.addEventListener('scroll', () => viewHandle?.refresh(), { passive: true });

  await WebRTCReceiver.start({
    enableBackgroundAudio: true,
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  });

  // 1) Get remote offer from your signaling
  const offer = await waitForRemoteOffer();
  await WebRTCReceiver.setRemoteDescription(offer);

  // 2) Create answer and send it back
  const answer = await WebRTCReceiver.createAnswer();
  signalingSend({ type: 'answer', answer });

  // 3) As remote ICE arrives:
  // await WebRTCReceiver.addIceCandidate(cand)
}

async function stop() {
  await viewHandle?.destroy();
  viewHandle = null;
  await WebRTCReceiver.stop();
}

// wire up buttons
document.getElementById('start')!.addEventListener('click', start);
document.getElementById('stop')!.addEventListener('click', stop);

// Example: handle signaling messages
function onSignalingMessage(msg: any) {
  if (msg.type === 'offer') WebRTCReceiver.setRemoteDescription(msg.offer);
  if (msg.type === 'ice') WebRTCReceiver.addIceCandidate(msg.cand);
}


⸻

3) Native behavior for background / minimized

What we implement
	•	Audio continues in background/lock (iOS background audio + Android foreground service)
	•	Video overlay view is detached/hidden when app backgrounds
	•	On foreground, re-attach overlay and video resumes
	•	A/V stays synced because the PeerConnection stays alive

⸻

4) Android implementation (Kotlin)

Gradle dependency

In the plugin’s Android module build.gradle add WebRTC:

dependencies {
  implementation "org.webrtc:google-webrtc:1.0.32006" // example; pin a known-good version in your repo
}

WebRTCReceiverPlugin.kt (core skeleton)

package com.example.webrtcreceiver

import android.content.Intent
import android.media.AudioManager
import android.view.View
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.webrtc.*

@CapacitorPlugin(name = "WebRTCReceiver")
class WebRTCReceiverPlugin : Plugin() {

  private var factory: PeerConnectionFactory? = null
  private var pc: PeerConnection? = null
  private var eglBase: EglBase? = null

  // Simple native overlay views registry
  private val views = mutableMapOf<String, SurfaceViewRenderer>()

  override fun load() {
    super.load()
    eglBase = EglBase.create()

    val initOptions = PeerConnectionFactory.InitializationOptions.builder(context)
      .createInitializationOptions()
    PeerConnectionFactory.initialize(initOptions)

    val encoderFactory = DefaultVideoEncoderFactory(eglBase!!.eglBaseContext, true, true)
    val decoderFactory = DefaultVideoDecoderFactory(eglBase!!.eglBaseContext)

    factory = PeerConnectionFactory.builder()
      .setVideoEncoderFactory(encoderFactory)
      .setVideoDecoderFactory(decoderFactory)
      .createPeerConnectionFactory()
  }

  @PluginMethod
  fun start(call: PluginCall) {
    val enableBackgroundAudio = call.getBoolean("enableBackgroundAudio", true)

    if (enableBackgroundAudio) {
      // Foreground service keeps process alive more reliably
      val intent = Intent(context, WebRTCFgService::class.java)
      context.startForegroundService(intent)
    }

    val iceServers = (call.getArray("iceServers") ?: JSArray()).toList().mapNotNull { any ->
      val obj = any as? JSObject ?: return@mapNotNull null
      val urlsAny = obj.get("urls")
      val urls = when (urlsAny) {
        is String -> listOf(urlsAny)
        is JSArray -> urlsAny.toList().map { it.toString() }
        else -> emptyList()
      }
      val b = PeerConnection.IceServer.builder(urls)
      obj.getString("username")?.let { b.setUsername(it) }
      obj.getString("credential")?.let { b.setPassword(it) }
      b.createIceServer()
    }

    val rtcConfig = PeerConnection.RTCConfiguration(iceServers)
    rtcConfig.sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN

    pc = factory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
      override fun onIceCandidate(candidate: IceCandidate) {
        val data = JSObject()
        data.put("candidate", candidate.sdp)
        data.put("sdpMid", candidate.sdpMid)
        data.put("sdpMLineIndex", candidate.sdpMLineIndex)
        notifyListeners("iceCandidate", data)
      }

      override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
        val data = JSObject().put("state", newState.name)
        notifyListeners("connectionState", data)
      }

      override fun onTrack(transceiver: RtpTransceiver) {
        val track = transceiver.receiver.track() ?: return
        if (track.kind() == MediaStreamTrack.VIDEO_TRACK_KIND) {
          val v = track as VideoTrack
          // Attach to all existing renderers
          for (renderer in views.values) v.addSink(renderer)
        }
      }

      // Unused but required:
      override fun onSignalingChange(p0: PeerConnection.SignalingState) {}
      override fun onIceConnectionChange(p0: PeerConnection.IceConnectionState) {}
      override fun onIceConnectionReceivingChange(p0: Boolean) {}
      override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState) {}
      override fun onIceCandidatesRemoved(p0: Array<IceCandidate>) {}
      override fun onAddStream(p0: MediaStream) {}
      override fun onRemoveStream(p0: MediaStream) {}
      override fun onDataChannel(p0: DataChannel) {}
      override fun onRenegotiationNeeded() {}
      override fun onAddTrack(p0: RtpReceiver, p1: Array<out MediaStream>) {}
    })

    call.resolve()
  }

  @PluginMethod
  fun stop(call: PluginCall) {
    // stop service
    try {
      context.stopService(Intent(context, WebRTCFgService::class.java))
    } catch (_: Exception) {}

    // detach sinks
    views.values.forEach { it.release() }
    views.clear()

    pc?.close()
    pc = null
    call.resolve()
  }

  @PluginMethod
  fun setRemoteDescription(call: PluginCall) {
    val type = call.getString("type") ?: return call.reject("Missing type")
    val sdp = call.getString("sdp") ?: return call.reject("Missing sdp")
    val desc = SessionDescription(
      if (type == "offer") SessionDescription.Type.OFFER else SessionDescription.Type.ANSWER,
      sdp
    )
    pc?.setRemoteDescription(SimpleSdpObserver { call.resolve() }, desc)
      ?: call.reject("PeerConnection not started")
  }

  @PluginMethod
  fun createAnswer(call: PluginCall) {
    val constraints = MediaConstraints()
    constraints.mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
    constraints.mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))

    pc?.createAnswer(object : SdpObserver {
      override fun onCreateSuccess(desc: SessionDescription) {
        pc?.setLocalDescription(SimpleSdpObserver {
          val res = JSObject()
          res.put("type", "answer")
          res.put("sdp", desc.description)
          call.resolve(res)
        }, desc)
      }
      override fun onCreateFailure(p0: String) = call.reject(p0)
      override fun onSetSuccess() {}
      override fun onSetFailure(p0: String) {}
    }, constraints) ?: call.reject("PeerConnection not started")
  }

  @PluginMethod
  fun addIceCandidate(call: PluginCall) {
    val candidate = call.getString("candidate") ?: return call.reject("Missing candidate")
    val sdpMid = call.getString("sdpMid")
    val sdpMLineIndex = call.getInt("sdpMLineIndex") ?: 0
    val ice = IceCandidate(sdpMid, sdpMLineIndex, candidate)
    pc?.addIceCandidate(ice)
    call.resolve()
  }

  @PluginMethod
  fun setSpeakerphoneOn(call: PluginCall) {
    val on = call.getBoolean("on", true)
    val am = context.getSystemService(android.content.Context.AUDIO_SERVICE) as AudioManager
    am.isSpeakerphoneOn = on
    call.resolve()
  }

  @PluginMethod
  fun createVideoView(call: PluginCall) {
    val viewId = java.util.UUID.randomUUID().toString()
    val x = call.getInt("x") ?: 0
    val y = call.getInt("y") ?: 0
    val w = call.getInt("width") ?: 100
    val h = call.getInt("height") ?: 100

    val renderer = SurfaceViewRenderer(context)
    renderer.init(eglBase!!.eglBaseContext, null)
    renderer.setZOrderMediaOverlay(true)

    // position as overlay on top of WebView
    val lp = android.widget.FrameLayout.LayoutParams(w, h)
    lp.leftMargin = x
    lp.topMargin = y

    bridge.activity.runOnUiThread {
      (bridge.webView.parent as android.widget.FrameLayout).addView(renderer, lp)
      views[viewId] = renderer
    }

    // if track already exists, it will be attached in onTrack; also attach existing track if any
    call.resolve(JSObject().put("viewId", viewId))
  }

  @PluginMethod
  fun updateVideoView(call: PluginCall) {
    val viewId = call.getString("viewId") ?: return call.reject("Missing viewId")
    val renderer = views[viewId] ?: return call.reject("Unknown viewId")

    val x = call.getInt("x")
    val y = call.getInt("y")
    val w = call.getInt("width")
    val h = call.getInt("height")

    bridge.activity.runOnUiThread {
      val lp = renderer.layoutParams as android.widget.FrameLayout.LayoutParams
      if (x != null) lp.leftMargin = x
      if (y != null) lp.topMargin = y
      if (w != null) lp.width = w
      if (h != null) lp.height = h
      renderer.layoutParams = lp
      renderer.requestLayout()
    }
    call.resolve()
  }

  @PluginMethod
  fun destroyVideoView(call: PluginCall) {
    val viewId = call.getString("viewId") ?: return call.reject("Missing viewId")
    val renderer = views.remove(viewId) ?: return call.resolve()

    bridge.activity.runOnUiThread {
      (renderer.parent as? android.widget.FrameLayout)?.removeView(renderer)
      renderer.release()
    }
    call.resolve()
  }
}

private class SimpleSdpObserver(val onSuccess: () -> Unit) : SdpObserver {
  override fun onSetSuccess() = onSuccess()
  override fun onSetFailure(p0: String) {}
  override fun onCreateSuccess(p0: SessionDescription) {}
  override fun onCreateFailure(p0: String) {}
}

Foreground service (keeps audio alive)

WebRTCFgService.kt

package com.example.webrtcreceiver

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder

class WebRTCFgService : Service() {

  override fun onCreate() {
    super.onCreate()
    val channelId = "webrtc_receiver_call"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val chan = NotificationChannel(channelId, "WebRTC Receiver", NotificationManager.IMPORTANCE_LOW)
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(chan)
    }

    val notif = Notification.Builder(this, channelId)
      .setContentTitle("Call in progress")
      .setContentText("Receiving audio")
      .setSmallIcon(android.R.drawable.stat_sys_phone_call)
      .build()

    startForeground(1001, notif)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
  override fun onBind(intent: Intent?): IBinder? = null
}

AndroidManifest additions

<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />

<application>
  <service
    android:name=".WebRTCFgService"
    android:exported="false"
    android:foregroundServiceType="mediaPlayback" />
</application>


⸻

5) iOS implementation (Swift)

Add WebRTC

Most people use CocoaPods:

pod 'GoogleWebRTC'

Enable background audio

In Xcode:
	•	Signing & Capabilities → Background Modes → check Audio, AirPlay, and Picture in Picture (Audio is the key)

WebRTCReceiverPlugin.swift (core skeleton)

import Foundation
import Capacitor
import WebRTC
import AVFoundation

@objc(WebRTCReceiverPlugin)
public class WebRTCReceiverPlugin: CAPPlugin {

  private var factory: RTCPeerConnectionFactory?
  private var pc: RTCPeerConnection?

  private var views: [String: RTCMTLVideoView] = [:]
  private var remoteVideoTrack: RTCVideoTrack?

  public override func load() {
    super.load()
    RTCInitializeSSL()
    factory = RTCPeerConnectionFactory()
    NotificationCenter.default.addObserver(self, selector: #selector(onDidEnterBackground),
                                           name: UIApplication.didEnterBackgroundNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(onWillEnterForeground),
                                           name: UIApplication.willEnterForegroundNotification, object: nil)
  }

  @objc func start(_ call: CAPPluginCall) {
    let enableBackgroundAudio = call.getBool("enableBackgroundAudio") ?? true
    if enableBackgroundAudio {
      configureAudioSession()
    }

    let iceServers = (call.getArray("iceServers") as? [[String: Any]]) ?? []
    let rtcIceServers: [RTCIceServer] = iceServers.map { s in
      let urls = s["urls"]
      let urlStrings: [String]
      if let u = urls as? String { urlStrings = [u] }
      else if let u = urls as? [String] { urlStrings = u }
      else { urlStrings = [] }

      let username = s["username"] as? String
      let credential = s["credential"] as? String
      return RTCIceServer(urlStrings: urlStrings, username: username ?? "", credential: credential ?? "")
    }

    let config = RTCConfiguration()
    config.iceServers = rtcIceServers
    config.sdpSemantics = .unifiedPlan

    let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)

    pc = factory?.peerConnection(with: config, constraints: constraints, delegate: self)
    call.resolve()
  }

  @objc func stop(_ call: CAPPluginCall) {
    // remove views
    for (_, v) in views { v.removeFromSuperview() }
    views.removeAll()
    remoteVideoTrack = nil

    pc?.close()
    pc = nil
    call.resolve()
  }

  @objc func setRemoteDescription(_ call: CAPPluginCall) {
    guard let typeStr = call.getString("type"), let sdp = call.getString("sdp") else {
      return call.reject("Missing type/sdp")
    }
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    let type: RTCSdpType = (typeStr == "offer") ? .offer : .answer
    let desc = RTCSessionDescription(type: type, sdp: sdp)

    pc.setRemoteDescription(desc) { err in
      if let err = err { call.reject(err.localizedDescription) }
      else { call.resolve() }
    }
  }

  @objc func createAnswer(_ call: CAPPluginCall) {
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    let mandatory = ["OfferToReceiveAudio": "true", "OfferToReceiveVideo": "true"]
    let constraints = RTCMediaConstraints(mandatoryConstraints: mandatory, optionalConstraints: nil)

    pc.answer(for: constraints) { [weak self] sdp, err in
      if let err = err { return call.reject(err.localizedDescription) }
      guard let sdp = sdp else { return call.reject("No SDP") }

      pc.setLocalDescription(sdp) { err2 in
        if let err2 = err2 { return call.reject(err2.localizedDescription) }
        call.resolve(["type": "answer", "sdp": sdp.sdp])
      }
    }
  }

  @objc func addIceCandidate(_ call: CAPPluginCall) {
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    guard let cand = call.getString("candidate") else { return call.reject("Missing candidate") }
    let sdpMid = call.getString("sdpMid")
    let sdpMLineIndex = call.getInt("sdpMLineIndex") ?? 0

    let ice = RTCIceCandidate(sdp: cand, sdpMLineIndex: Int32(sdpMLineIndex), sdpMid: sdpMid)
    pc.add(ice)
    call.resolve()
  }

  @objc func setSpeakerphoneOn(_ call: CAPPluginCall) {
    // iOS routing is mostly via AVAudioSession; simplest approach:
    let on = call.getBool("on") ?? true
    do {
      try AVAudioSession.sharedInstance().overrideOutputAudioPort(on ? .speaker : .none)
      call.resolve()
    } catch {
      call.reject(error.localizedDescription)
    }
  }

  @objc func createVideoView(_ call: CAPPluginCall) {
    let viewId = UUID().uuidString
    let x = CGFloat(call.getInt("x") ?? 0)
    let y = CGFloat(call.getInt("y") ?? 0)
    let w = CGFloat(call.getInt("width") ?? 100)
    let h = CGFloat(call.getInt("height") ?? 100)

    DispatchQueue.main.async { [weak self] in
      guard let self = self, let vcView = self.bridge?.viewController?.view else { return }
      let v = RTCMTLVideoView(frame: CGRect(x: x, y: y, width: w, height: h))
      v.videoContentMode = .scaleAspectFit
      v.backgroundColor = .black
      vcView.addSubview(v)
      self.views[viewId] = v

      if let track = self.remoteVideoTrack {
        track.add(v)
      }
    }

    call.resolve(["viewId": viewId])
  }

  @objc func updateVideoView(_ call: CAPPluginCall) {
    guard let viewId = call.getString("viewId"), let v = views[viewId] else {
      return call.reject("Unknown viewId")
    }

    let x = call.getInt("x")
    let y = call.getInt("y")
    let w = call.getInt("width")
    let h = call.getInt("height")

    DispatchQueue.main.async {
      var f = v.frame
      if let x = x { f.origin.x = CGFloat(x) }
      if let y = y { f.origin.y = CGFloat(y) }
      if let w = w { f.size.width = CGFloat(w) }
      if let h = h { f.size.height = CGFloat(h) }
      v.frame = f
    }
    call.resolve()
  }

  @objc func destroyVideoView(_ call: CAPPluginCall) {
    guard let viewId = call.getString("viewId"), let v = views.removeValue(forKey: viewId) else {
      return call.resolve()
    }
    DispatchQueue.main.async {
      v.removeFromSuperview()
    }
    call.resolve()
  }

  private func configureAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth])
      try session.setActive(true)
    } catch {
      // If this fails, background audio may not work reliably
    }
  }

  // Background behavior: pause video rendering but keep audio alive
  @objc private func onDidEnterBackground() {
    DispatchQueue.main.async { [weak self] in
      self?.views.values.forEach { $0.isHidden = true }
    }
  }

  @objc private func onWillEnterForeground() {
    DispatchQueue.main.async { [weak self] in
      self?.views.values.forEach { $0.isHidden = false }
    }
  }
}

extension WebRTCReceiverPlugin: RTCPeerConnectionDelegate {
  public func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
  public func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
  public func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
  public func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}

  public func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCPeerConnectionState) {
    notifyListeners("connectionState", data: ["state": "\(newState)"])
  }

  public func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
  public func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}

  public func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
    notifyListeners("iceCandidate", data: [
      "candidate": candidate.sdp,
      "sdpMid": candidate.sdpMid as Any,
      "sdpMLineIndex": Int(candidate.sdpMLineIndex)
    ])
  }

  public func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}

  public func peerConnection(_ peerConnection: RTCPeerConnection,
                             didStartReceivingOn transceiver: RTCRtpTransceiver) {}

  public func peerConnection(_ peerConnection: RTCPeerConnection,
                             didAdd rtpReceiver: RTCRtpReceiver,
                             streams: [RTCMediaStream]) {
    if let track = rtpReceiver.track as? RTCVideoTrack {
      remoteVideoTrack = track
      // attach to existing views
      for (_, v) in views { track.add(v) }
    }
  }

  public func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}


⸻

6) “Nice to have”: video in native player when minimized

Android (feasible)
	•	Add an optional enterPip() method that launches a tiny Activity and calls enterPictureInPictureMode().
	•	Render WebRTC to a SurfaceView in that Activity.

iOS (harder)
	•	True PiP for WebRTC requires feeding frames into an AVSampleBufferDisplayLayer and driving AVPictureInPictureController. That’s a separate chunk of work.
	•	If you want, I can add it as an optional module once your core receive-only calling is stable.

In the plugin API you can reserve:
	•	enterPictureInPicture() / exitPictureInPicture()
…and no-op it on iOS initially.

⸻

Integration notes / gotchas
	•	Because the native video is an overlay, you must reposition it on layout changes (use the helper’s refresh() on resize/scroll or route changes).
	•	Keep signaling in JS for now, and avoid renegotiation while backgrounded. This design doesn’t need renegotiation to pause video.
	•	For iOS background audio to work reliably, you must enable the background capability and keep the audio session active.
