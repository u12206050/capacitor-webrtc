/**
 * Example usage of DataChannel in the WebRTC Receiver plugin
 */

import { WebRTCReceiver } from './src/index';

// Listen for incoming data channels (created by remote peer)
WebRTCReceiver.addListener('dataChannel', (event) => {
  console.log('Data channel opened:', event.channelId, event.label);
  
  // You can now send/receive data on this channel
});

// Listen for messages on data channels
WebRTCReceiver.addListener('dataChannelMessage', (event) => {
  console.log('Message received on channel', event.channelId);
  
  if (event.binary) {
    // Binary data is base64 encoded
    const binaryData = atob(event.data); // decode base64
    console.log('Binary data received:', binaryData.length, 'bytes');
  } else {
    // Text data
    console.log('Text message:', event.data);
  }
});

// Listen for data channel state changes
WebRTCReceiver.addListener('dataChannelState', (event) => {
  console.log('Channel', event.channelId, 'state changed to:', event.state);
  // States: "connecting", "open", "closing", "closed"
});

// Create a data channel
async function createChannel() {
  const { channelId } = await WebRTCReceiver.createDataChannel({
    label: 'my-channel',
    ordered: true, // Messages are delivered in order
    maxRetransmits: 3, // Optional: max retransmission attempts
    protocol: 'my-protocol', // Optional: custom protocol string
  });
  
  console.log('Created data channel:', channelId);
  return channelId;
}

// Send text data
async function sendText(channelId: string, message: string) {
  await WebRTCReceiver.sendData({
    channelId,
    data: message,
    binary: false,
  });
}

// Send binary data (as base64 string)
async function sendBinary(channelId: string, binaryData: ArrayBuffer) {
  // Convert ArrayBuffer to base64
  const base64 = btoa(String.fromCharCode(...new Uint8Array(binaryData)));
  
  await WebRTCReceiver.sendData({
    channelId,
    data: base64,
    binary: true,
  });
}

// Send binary data (as array of numbers)
async function sendBinaryAsArray(channelId: string, bytes: number[]) {
  await WebRTCReceiver.sendData({
    channelId,
    data: bytes,
    binary: true,
  });
}

// Close a data channel
async function closeChannel(channelId: string) {
  await WebRTCReceiver.closeDataChannel({ channelId });
}

// Complete example: Create channel, send data, receive data
async function example() {
  // Start WebRTC session first
  await WebRTCReceiver.start({
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  });
  
  // Create a data channel
  const channelId = await createChannel();
  
  // Send a text message
  await sendText(channelId, 'Hello from Capacitor!');
  
  // Send binary data
  const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
  await sendBinary(channelId, binaryData.buffer);
  
  // Messages will be received via the 'dataChannelMessage' event listener
}

