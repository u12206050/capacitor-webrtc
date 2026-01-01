import { WebPlugin } from '@capacitor/core';
import type { WebRTCReceiverPlugin } from './definitions';

export class WebRTCReceiverWeb extends WebPlugin implements WebRTCReceiverPlugin {
  async start(_options?: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async stop(): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async setRemoteDescription(_desc: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async createAnswer(): Promise<any> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async createOffer(): Promise<any> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async setLocalDescription(_desc: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async addIceCandidate(_cand: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async createVideoView(_options: any): Promise<{ viewId: string }> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async updateVideoView(_options: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async destroyVideoView(_options: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async setSpeakerphoneOn(_options: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async createDataChannel(_options: any): Promise<{ channelId: string }> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async sendData(_options: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async closeDataChannel(_options: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async getUserMedia(_options?: any): Promise<{ tracks: any[] }> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async addTrack(_trackId: string): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async removeTrack(_trackId: string): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async getTracks(): Promise<{ tracks: any[] }> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async setTrackEnabled(_options: any): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async switchCamera(): Promise<void> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async getAudioInputDevices(): Promise<{ devices: any[] }> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }

  async getVideoInputDevices(): Promise<{ devices: any[] }> {
    throw this.unimplemented('WebRTCReceiver is not implemented on web');
  }
}

