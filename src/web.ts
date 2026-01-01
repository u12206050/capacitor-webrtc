import { WebPlugin } from '@capacitor/core';
import type {
    CreateDataChannelOptions,
    CreateVideoViewOptions,
    GetUserMediaOptions,
    IceCandidate,
    MediaTrack,
    SdpDescription,
    SendDataOptions,
    StartOptions,
    UpdateVideoViewOptions,
    WebRTCReceiverPlugin,
} from './definitions';

interface VideoView {
  videoElement: HTMLVideoElement;
  container: HTMLElement;
  stream: MediaStream | null;
}

export class WebRTCReceiverWeb extends WebPlugin implements WebRTCReceiverPlugin {
  // addListener and removeAllListeners are inherited from WebPlugin
  // notifyListeners is also inherited from WebPlugin
  
  async addListener(
    eventName: 'iceCandidate' | 'connectionState' | 'dataChannel' | 'dataChannelMessage' | 'dataChannelState',
    listenerFunc: (data: any) => void
  ): Promise<any> {
    return super.addListener(eventName, listenerFunc);
  }

  async removeAllListeners(): Promise<void> {
    return super.removeAllListeners();
  }

  // Type-safe wrapper for notifyListeners
  private notify(eventName: string, data: any): void {
    (this as any).notifyListeners(eventName, data);
  }
  private pc: RTCPeerConnection | null = null;
  private localTracks: Map<string, MediaStreamTrack> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private videoViews: Map<string, VideoView> = new Map();
  private iceServers: RTCConfiguration['iceServers'] = [];
  private currentVideoDeviceId: string | null = null;
  private currentAudioDeviceId: string | null = null;

  async start(options?: StartOptions): Promise<void> {
    // Convert iceServers to RTCIceServer format
    this.iceServers = (options?.iceServers || []).map(server => {
      const urls = typeof server.urls === 'string' ? [server.urls] : server.urls;
      return {
        urls,
        username: server.username,
        credential: server.credential,
      } as RTCIceServer;
    });

    // Create peer connection
    const config: RTCConfiguration = {
      iceServers: this.iceServers,
    };
    // @ts-ignore - sdpSemantics is supported but not in all type definitions
    config.sdpSemantics = 'unified-plan';
    this.pc = new RTCPeerConnection(config);

    // Set up event handlers
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.notify('iceCandidate', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid || undefined,
          sdpMLineIndex: event.candidate.sdpMLineIndex || undefined,
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.notify('connectionState', {
          state: this.pc.connectionState,
        });
      }
    };

    this.pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        const streamId = stream.id;
        this.remoteStreams.set(streamId, stream);
        
        // Attach to all video views
        this.videoViews.forEach((view) => {
          if (view.videoElement && !view.stream) {
            view.videoElement.srcObject = stream;
            view.stream = stream;
          }
        });
      }
    };

    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      const channelId = channel.label;
      this.dataChannels.set(channelId, channel);

        this.notify('dataChannel', {
        channelId,
        label: channel.label,
      });

      channel.onmessage = (event) => {
        let data: string;
        if (event.data instanceof ArrayBuffer) {
          // Convert ArrayBuffer to base64
          const bytes = new Uint8Array(event.data);
          data = btoa(String.fromCharCode(...bytes));
        } else if (event.data instanceof Blob) {
          // For Blob, we'd need to read it asynchronously
          // For now, convert to base64 via FileReader
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            this.notify('dataChannelMessage', {
              channelId,
              data: base64,
              binary: true,
            });
          };
          reader.readAsDataURL(event.data);
          return;
        } else {
          data = event.data;
        }

        this.notify('dataChannelMessage', {
          channelId,
          data,
          binary: event.data instanceof ArrayBuffer || event.data instanceof Blob,
        });
      };

      channel.addEventListener('statechange', () => {
        this.notify('dataChannelState', {
          channelId,
          state: channel.readyState,
        });
      });
    };
  }

  async stop(): Promise<void> {
    // Stop all local tracks
    this.localTracks.forEach((track) => {
      track.stop();
    });
    this.localTracks.clear();

    // Close all data channels
    this.dataChannels.forEach((channel) => {
      channel.close();
    });
    this.dataChannels.clear();

    // Remove all video views
    this.videoViews.forEach((view) => {
      if (view.videoElement.srcObject) {
        const stream = view.videoElement.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        view.videoElement.srcObject = null;
      }
      view.container.removeChild(view.videoElement);
    });
    this.videoViews.clear();

    this.remoteStreams.clear();

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  async setRemoteDescription(desc: SdpDescription): Promise<void> {
    if (!this.pc) {
      throw new Error('PeerConnection not started');
    }

    await this.pc.setRemoteDescription(
      new RTCSessionDescription({
        type: desc.type,
        sdp: desc.sdp,
      })
    );
  }

  async createAnswer(): Promise<SdpDescription> {
    if (!this.pc) {
      throw new Error('PeerConnection not started');
    }

    const answer = await this.pc.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.pc.setLocalDescription(answer);

    return {
      type: 'answer',
      sdp: answer.sdp || '',
    };
  }

  async createOffer(): Promise<SdpDescription> {
    if (!this.pc) {
      throw new Error('PeerConnection not started');
    }

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.pc.setLocalDescription(offer);

    return {
      type: 'offer',
      sdp: offer.sdp || '',
    };
  }

  async setLocalDescription(desc: SdpDescription): Promise<void> {
    if (!this.pc) {
      throw new Error('PeerConnection not started');
    }

    await this.pc.setLocalDescription(
      new RTCSessionDescription({
        type: desc.type,
        sdp: desc.sdp,
      })
    );
  }

  async addIceCandidate(cand: IceCandidate): Promise<void> {
    if (!this.pc) {
      throw new Error('PeerConnection not started');
    }

    const iceCandidate: RTCIceCandidateInit = {
      candidate: cand.candidate,
    };
    if (cand.sdpMid) {
      iceCandidate.sdpMid = cand.sdpMid;
    }
    if (cand.sdpMLineIndex !== undefined) {
      iceCandidate.sdpMLineIndex = cand.sdpMLineIndex;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(iceCandidate));
  }

  async createVideoView(options: CreateVideoViewOptions): Promise<{ viewId: string }> {
    const viewId = `video_view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create video element
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.style.position = 'fixed';
    videoElement.style.left = `${options.x ?? 0}px`;
    videoElement.style.top = `${options.y ?? 0}px`;
    videoElement.style.width = `${options.width ?? 100}px`;
    videoElement.style.height = `${options.height ?? 100}px`;
    videoElement.style.zIndex = '999999';
    videoElement.style.objectFit = options.mode === 'fill' ? 'cover' : 'contain';
    videoElement.style.backgroundColor = '#000';

    // Create container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.pointerEvents = 'none';
    container.appendChild(videoElement);
    document.body.appendChild(container);

    // Attach any existing remote stream
    if (this.remoteStreams.size > 0) {
      const firstStream = Array.from(this.remoteStreams.values())[0];
      videoElement.srcObject = firstStream;
    }

    this.videoViews.set(viewId, {
      videoElement,
      container,
      stream: videoElement.srcObject as MediaStream | null,
    });

    return { viewId };
  }

  async updateVideoView(options: UpdateVideoViewOptions & { viewId: string }): Promise<void> {
    const view = this.videoViews.get(options.viewId);
    if (!view) {
      throw new Error('Unknown viewId');
    }

    if (options.x !== undefined) {
      view.videoElement.style.left = `${options.x}px`;
    }
    if (options.y !== undefined) {
      view.videoElement.style.top = `${options.y}px`;
    }
    if (options.width !== undefined) {
      view.videoElement.style.width = `${options.width}px`;
    }
    if (options.height !== undefined) {
      view.videoElement.style.height = `${options.height}px`;
    }
    if (options.mode !== undefined) {
      view.videoElement.style.objectFit = options.mode === 'fill' ? 'cover' : 'contain';
    }
  }

  async destroyVideoView(options: { viewId: string }): Promise<void> {
    const view = this.videoViews.get(options.viewId);
    if (!view) {
      return;
    }

    if (view.videoElement.srcObject) {
      const stream = view.videoElement.srcObject as MediaStream;
      // Don't stop the stream, just remove the reference
      view.videoElement.srcObject = null;
    }

    view.container.removeChild(view.videoElement);
    document.body.removeChild(view.container);
    this.videoViews.delete(options.viewId);
  }

  async setSpeakerphoneOn(options: { on: boolean }): Promise<void> {
    // On web, we can't directly control speakerphone
    // But we can set audio output device if supported
    if ('setSinkId' in HTMLAudioElement.prototype) {
      // This is a workaround - we'd need to find audio elements
      // For now, just resolve (no-op)
    }
    // No-op on web
  }

  async createDataChannel(options: CreateDataChannelOptions): Promise<{ channelId: string }> {
    if (!this.pc) {
      throw new Error('PeerConnection not started');
    }

    const channelInit: RTCDataChannelInit = {
      ordered: options.ordered !== false,
    };

    if (options.maxPacketLifeTime !== undefined) {
      channelInit.maxPacketLifeTime = options.maxPacketLifeTime;
    }
    if (options.maxRetransmits !== undefined) {
      channelInit.maxRetransmits = options.maxRetransmits;
    }
    if (options.protocol !== undefined) {
      channelInit.protocol = options.protocol;
    }
    if (options.negotiated !== undefined) {
      channelInit.negotiated = options.negotiated;
    }
    if (options.id !== undefined) {
      channelInit.id = options.id;
    }

    const channel = this.pc.createDataChannel(options.label, channelInit);
    const channelId = options.label;
    this.dataChannels.set(channelId, channel);

    channel.onmessage = (event) => {
      let data: string;
      if (event.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(event.data);
        data = btoa(String.fromCharCode(...bytes));
      } else if (event.data instanceof Blob) {
        const reader = new FileReader();
          reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          this.notify('dataChannelMessage', {
            channelId,
            data: base64,
            binary: true,
          });
        };
        reader.readAsDataURL(event.data);
        return;
      } else {
        data = event.data;
      }

      this.notify('dataChannelMessage', {
        channelId,
        data,
        binary: event.data instanceof ArrayBuffer || event.data instanceof Blob,
      });
    };

      channel.addEventListener('statechange', () => {
        this.notify('dataChannelState', {
          channelId,
          state: channel.readyState,
        });
      });

    return { channelId };
  }

  async sendData(options: SendDataOptions): Promise<void> {
    const channel = this.dataChannels.get(options.channelId);
    if (!channel) {
      throw new Error('Unknown channelId');
    }

    if (options.binary) {
      let data: ArrayBuffer;
      if (typeof options.data === 'string') {
        // Assume base64
        const binaryString = atob(options.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        data = bytes.buffer;
      } else if (options.data instanceof ArrayBuffer) {
        data = options.data;
      } else if (options.data instanceof Uint8Array) {
        // Create a new ArrayBuffer copy
        const newBuffer = new ArrayBuffer(options.data.length);
        new Uint8Array(newBuffer).set(options.data);
        data = newBuffer;
      } else {
        throw new Error('Invalid binary data format');
      }
      channel.send(data);
    } else {
      const text = typeof options.data === 'string' ? options.data : String(options.data);
      channel.send(text);
    }
  }

  async closeDataChannel(options: { channelId: string }): Promise<void> {
    const channel = this.dataChannels.get(options.channelId);
    if (!channel) {
      return;
    }

    channel.close();
    this.dataChannels.delete(options.channelId);
  }

  async getUserMedia(options?: GetUserMediaOptions): Promise<{ tracks: MediaTrack[] }> {
    const constraints: MediaStreamConstraints = {
      audio: options?.audio !== false,
      video: options?.video !== false,
    };

    // Handle video constraints
    if (options?.video) {
      if (typeof options.video === 'object') {
        constraints.video = options.video;
      } else if (options.videoDeviceId || options.facingMode) {
        constraints.video = {
          deviceId: options.videoDeviceId
            ? { exact: options.videoDeviceId }
            : undefined,
          facingMode: options.facingMode,
        };
      }
    }

    // Handle audio constraints
    if (options?.audio && typeof options.audio === 'object') {
      constraints.audio = options.audio;
    } else if (options?.audioDeviceId) {
      constraints.audio = {
        deviceId: { exact: options.audioDeviceId },
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const tracks: MediaTrack[] = [];

    stream.getTracks().forEach((track) => {
      const trackId = track.id;
      this.localTracks.set(trackId, track);

      // Store device IDs for camera switching
      if (track.kind === 'video' && track.getSettings().deviceId) {
        this.currentVideoDeviceId = track.getSettings().deviceId!;
      }
      if (track.kind === 'audio' && track.getSettings().deviceId) {
        this.currentAudioDeviceId = track.getSettings().deviceId!;
      }

      tracks.push({
        trackId,
        kind: track.kind as 'audio' | 'video',
        enabled: track.enabled,
        muted: !track.enabled,
      });
    });

    return { tracks };
  }

  async addTrack(trackId: string): Promise<void> {
    if (!this.pc) {
      throw new Error('PeerConnection not started');
    }

    const track = this.localTracks.get(trackId);
    if (!track) {
      throw new Error('Unknown trackId');
    }

    this.pc.addTrack(track);
  }

  async removeTrack(trackId: string): Promise<void> {
    if (!this.pc) {
      throw new Error('PeerConnection not started');
    }

    const track = this.localTracks.get(trackId);
    if (!track) {
      throw new Error('Unknown trackId');
    }

    const sender = this.pc.getSenders().find((s) => s.track?.id === trackId);
    if (sender) {
      this.pc.removeTrack(sender);
    }
  }

  async getTracks(): Promise<{ tracks: MediaTrack[] }> {
    const tracks: MediaTrack[] = [];

    this.localTracks.forEach((track) => {
      tracks.push({
        trackId: track.id,
        kind: track.kind as 'audio' | 'video',
        enabled: track.enabled,
        muted: !track.enabled,
      });
    });

    return { tracks };
  }

  async setTrackEnabled(options: { trackId: string; enabled: boolean }): Promise<void> {
    const track = this.localTracks.get(options.trackId);
    if (!track) {
      throw new Error('Unknown trackId');
    }

    track.enabled = options.enabled;
  }

  async switchCamera(): Promise<void> {
    // Get current video track
    const videoTrack = Array.from(this.localTracks.values()).find(
      (track) => track.kind === 'video'
    );

    if (!videoTrack) {
      throw new Error('No video track active');
    }

    // Get available video devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');

    if (videoDevices.length < 2) {
      throw new Error('Only one camera available');
    }

    // Find current device
    const currentSettings = videoTrack.getSettings();
    const currentDeviceIndex = videoDevices.findIndex(
      (device) => device.deviceId === currentSettings.deviceId
    );

    // Switch to next device
    const nextDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextDeviceIndex];

    // Stop current track
    videoTrack.stop();
    this.localTracks.delete(videoTrack.id);

    // Get new stream with next device
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: nextDevice.deviceId } },
      audio: Array.from(this.localTracks.values())
        .filter((t) => t.kind === 'audio')
        .length > 0,
    });

    // Replace video track
    const newVideoTrack = stream.getVideoTracks()[0];
    this.localTracks.set(newVideoTrack.id, newVideoTrack);
    this.currentVideoDeviceId = newVideoTrack.getSettings().deviceId!;

    // Update peer connection
    if (this.pc) {
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      } else {
        this.pc.addTrack(newVideoTrack);
      }
    }
  }

  async getAudioInputDevices(): Promise<{ devices: Array<{ deviceId: string; label: string }> }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices
      .filter((device) => device.kind === 'audioinput')
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Audio Input ${device.deviceId}`,
      }));

    return { devices: audioDevices };
  }

  async getVideoInputDevices(): Promise<{ devices: Array<{ deviceId: string; label: string }> }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId}`,
      }));

    return { devices: videoDevices };
  }
}
