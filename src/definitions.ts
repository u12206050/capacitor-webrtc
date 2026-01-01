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

export interface CreateDataChannelOptions {
  label: string;
  ordered?: boolean; // default true
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  protocol?: string;
  negotiated?: boolean; // default false
  id?: number; // required if negotiated is true
}

export interface SendDataOptions {
  channelId: string;
  data: string | ArrayBuffer | Uint8Array;
  binary?: boolean; // default false (treat as text)
}

export interface GetUserMediaOptions {
  audio?: boolean | MediaTrackConstraints; // default true
  video?: boolean | MediaTrackConstraints; // default true
  audioDeviceId?: string; // iOS/Android specific device ID
  videoDeviceId?: string; // iOS/Android specific device ID
  facingMode?: 'user' | 'environment'; // 'user' = front camera, 'environment' = back camera
}

export interface MediaTrack {
  trackId: string;
  kind: 'audio' | 'video';
  enabled: boolean;
  muted?: boolean;
}

export interface WebRTCReceiverPlugin {
  start(options?: StartOptions): Promise<void>;
  stop(): Promise<void>;

  setRemoteDescription(desc: SdpDescription): Promise<void>;
  createAnswer(): Promise<SdpDescription>;
  createOffer(): Promise<SdpDescription>;
  setLocalDescription(desc: SdpDescription): Promise<void>;
  addIceCandidate(cand: IceCandidate): Promise<void>;

  // Native video overlay view management
  createVideoView(options: CreateVideoViewOptions): Promise<{ viewId: string }>;
  updateVideoView(options: UpdateVideoViewOptions & { viewId: string }): Promise<void>;
  destroyVideoView(options: { viewId: string }): Promise<void>;

  // Optional: speaker / routing controls (useful for receive-only)
  setSpeakerphoneOn(options: { on: boolean }): Promise<void>;

  // DataChannel methods
  createDataChannel(options: CreateDataChannelOptions): Promise<{ channelId: string }>;
  sendData(options: SendDataOptions): Promise<void>;
  closeDataChannel(options: { channelId: string }): Promise<void>;

  // User Media methods (getUserMedia equivalent)
  getUserMedia(options?: GetUserMediaOptions): Promise<{ tracks: MediaTrack[] }>;
  addTrack(trackId: string): Promise<void>;
  removeTrack(trackId: string): Promise<void>;
  getTracks(): Promise<{ tracks: MediaTrack[] }>;
  setTrackEnabled(options: { trackId: string; enabled: boolean }): Promise<void>;
  switchCamera(): Promise<void>; // Switch between front/back camera
  getAudioInputDevices(): Promise<{ devices: Array<{ deviceId: string; label: string }> }>;
  getVideoInputDevices(): Promise<{ devices: Array<{ deviceId: string; label: string }> }>;

  // Event listeners
  addListener(
    eventName: 'iceCandidate',
    listenerFunc: (candidate: IceCandidate) => void,
  ): Promise<any>;
  addListener(
    eventName: 'connectionState',
    listenerFunc: (state: { state: string }) => void,
  ): Promise<any>;
  addListener(
    eventName: 'dataChannel',
    listenerFunc: (event: { channelId: string; label: string }) => void,
  ): Promise<any>;
  addListener(
    eventName: 'dataChannelMessage',
    listenerFunc: (event: { channelId: string; data: string; binary: boolean }) => void,
  ): Promise<any>;
  addListener(
    eventName: 'dataChannelState',
    listenerFunc: (event: { channelId: string; state: string }) => void,
  ): Promise<any>;
  removeAllListeners(): Promise<void>;
}

