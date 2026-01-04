import Foundation
import Capacitor
import WebRTC
import AVFoundation

@objc(CapWebRTCPlugin)
public class CapWebRTCPlugin: CAPPlugin {

  private var factory: RTCPeerConnectionFactory?
  private var pc: RTCPeerConnection?

  private var views: [String: RTCMTLVideoView] = [:]
  private var remoteVideoTrack: RTCVideoTrack?
  private var dataChannels: [String: RTCDataChannel] = [:]
  private var dataChannelDelegates: [String: DataChannelDelegate] = [:]
  private var localTracks: [String: RTCMediaStreamTrack] = [:]
  private var audioSource: RTCAudioSource?
  private var videoSource: RTCVideoSource?
  private var videoCapturer: RTCVideoCapturer?
  private var currentFacingMode: String = "user"

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
    
    // close data channels
    for (_, channel) in dataChannels { channel.close() }
    dataChannels.removeAll()
    dataChannelDelegates.removeAll()

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

  @objc func createOffer(_ call: CAPPluginCall) {
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    let mandatory = ["OfferToReceiveAudio": "true", "OfferToReceiveVideo": "true"]
    let constraints = RTCMediaConstraints(mandatoryConstraints: mandatory, optionalConstraints: nil)

    pc.offer(for: constraints) { [weak self] sdp, err in
      if let err = err { return call.reject(err.localizedDescription) }
      guard let sdp = sdp else { return call.reject("No SDP") }

      pc.setLocalDescription(sdp) { err2 in
        if let err2 = err2 { return call.reject(err2.localizedDescription) }
        call.resolve(["type": "offer", "sdp": sdp.sdp])
      }
    }
  }

  @objc func setLocalDescription(_ call: CAPPluginCall) {
    guard let typeStr = call.getString("type"), let sdp = call.getString("sdp") else {
      return call.reject("Missing type/sdp")
    }
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    let type: RTCSdpType = (typeStr == "offer") ? .offer : .answer
    let desc = RTCSessionDescription(type: type, sdp: sdp)

    pc.setLocalDescription(desc) { err in
      if let err = err { call.reject(err.localizedDescription) }
      else { call.resolve() }
    }
  }

  @objc func addIceCandidate(_ call: CAPPluginCall) {
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    guard let cand = call.getString("candidate") else { return call.reject("Missing candidate") }
    let sdpMid = call.getString("sdpMid")
    let sdpMLineIndex = call.getInt("sdpMLineIndex") ?? 0

    let ice = RTCIceCandidate(sdp: cand, sdpMLineIndex: Int32(sdpMLineIndex), sdpMid: sdpMid)
    pc.add(ice) { error in
      if let error = error {
        call.reject(error.localizedDescription)
      } else {
        call.resolve()
      }
    }
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

  @objc func getUserMedia(_ call: CAPPluginCall) {
    guard let factory = factory else { return call.reject("Factory not initialized") }
    
    let enableAudio = call.getBool("audio") ?? true
    let enableVideo = call.getBool("video") ?? true
    let facingMode = call.getString("facingMode") ?? "user"
    
    var trackInfos: [[String: Any]] = []
    
    // Create audio track
    if enableAudio {
      audioSource = factory.audioSource(with: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil))
      let audioTrack = factory.audioTrack(with: audioSource!, trackId: "audio_track_\(UUID().uuidString)")
      localTracks[audioTrack.trackId] = audioTrack
      
      trackInfos.append([
        "trackId": audioTrack.trackId,
        "kind": "audio",
        "enabled": audioTrack.isEnabled,
        "muted": !audioTrack.isEnabled
      ])
    }
    
    // Create video track
    if enableVideo {
      videoSource = factory.videoSource()
      
      // Find camera
      let captureDevices = RTCCameraVideoCapturer.captureDevices()
      var device: AVCaptureDevice?
      
      if let videoDeviceId = call.getString("videoDeviceId") {
        device = captureDevices.first { $0.uniqueID == videoDeviceId }
      } else {
        // Use facing mode
        for dev in captureDevices {
          if facingMode == "user" && dev.position == .front {
            device = dev
            break
          } else if facingMode == "environment" && dev.position == .back {
            device = dev
            break
          }
        }
      }
      
      if device == nil && !captureDevices.isEmpty {
        device = captureDevices[0] // Fallback to first available
      }
      
      if let device = device {
        videoCapturer = RTCCameraVideoCapturer(delegate: videoSource!)
        if let capturer = videoCapturer as? RTCCameraVideoCapturer {
          capturer.startCapture(with: device, format: device.activeFormat, fps: 30)
        }
        
        let videoTrack = factory.videoTrack(with: videoSource!, trackId: "video_track_\(UUID().uuidString)")
        localTracks[videoTrack.trackId] = videoTrack
        
        trackInfos.append([
          "trackId": videoTrack.trackId,
          "kind": "video",
          "enabled": videoTrack.isEnabled,
          "muted": !videoTrack.isEnabled
        ])
        
        currentFacingMode = facingMode
      }
    }
    
    call.resolve(["tracks": trackInfos])
  }

  @objc func addTrack(_ call: CAPPluginCall) {
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    guard let trackId = call.getString("trackId") else { return call.reject("Missing trackId") }
    guard let track = localTracks[trackId] else { return call.reject("Unknown trackId") }
    
    let streamIds = ["stream_\(UUID().uuidString)"]
    pc.add(track, streamIds: streamIds)
    call.resolve()
  }

  @objc func removeTrack(_ call: CAPPluginCall) {
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    guard let trackId = call.getString("trackId") else { return call.reject("Missing trackId") }
    guard let track = localTracks[trackId] else { return call.reject("Unknown trackId") }
    
    let senders = pc.senders
    for sender in senders {
      if sender.track?.trackId == trackId {
        pc.removeTrack(sender)
        call.resolve()
        return
      }
    }
    call.reject("Track not found in peer connection")
  }

  @objc func getTracks(_ call: CAPPluginCall) {
    let trackInfos = localTracks.values.map { track -> [String: Any] in
      [
        "trackId": track.trackId,
        "kind": track.kind,
        "enabled": track.isEnabled,
        "muted": !track.isEnabled
      ]
    }
    
    call.resolve(["tracks": trackInfos])
  }

  @objc func setTrackEnabled(_ call: CAPPluginCall) {
    guard let trackId = call.getString("trackId") else { return call.reject("Missing trackId") }
    guard let track = localTracks[trackId] else { return call.reject("Unknown trackId") }
    let enabled = call.getBool("enabled") ?? true
    
    track.isEnabled = enabled
    call.resolve()
  }

  @objc func switchCamera(_ call: CAPPluginCall) {
    guard let capturer = videoCapturer as? RTCCameraVideoCapturer else {
      return call.reject("No video track active")
    }
    
    let newFacingMode = currentFacingMode == "user" ? "environment" : "user"
    let captureDevices = RTCCameraVideoCapturer.captureDevices()
    
    var device: AVCaptureDevice?
    for dev in captureDevices {
      if newFacingMode == "user" && dev.position == .front {
        device = dev
        break
      } else if newFacingMode == "environment" && dev.position == .back {
        device = dev
        break
      }
    }
    
    if let device = device {
      capturer.stopCapture()
      capturer.startCapture(with: device, format: device.activeFormat, fps: 30)
      currentFacingMode = newFacingMode
      call.resolve()
    } else {
      call.reject("Camera not found")
    }
  }

  @objc func getAudioInputDevices(_ call: CAPPluginCall) {
    var devices: [[String: String]] = []
    devices.append([
      "deviceId": "default",
      "label": "Default Audio Input"
    ])
    call.resolve(["devices": devices])
  }

  @objc func getVideoInputDevices(_ call: CAPPluginCall) {
    let captureDevices = RTCCameraVideoCapturer.captureDevices()
    let devices = captureDevices.map { device -> [String: String] in
      [
        "deviceId": device.uniqueID,
        "label": device.position == .front ? "Front Camera" : "Back Camera"
      ]
    }
    call.resolve(["devices": devices])
  }

  private func configureAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [
        .allowBluetoothHFP, .allowBluetoothA2DP
      ])
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

  @objc func createDataChannel(_ call: CAPPluginCall) {
    guard let pc = pc else { return call.reject("PeerConnection not started") }
    guard let label = call.getString("label") else { return call.reject("Missing label") }
    
    let ordered = call.getBool("ordered") ?? true
    let maxPacketLifeTime = call.getInt("maxPacketLifeTime")
    let maxRetransmits = call.getInt("maxRetransmits")
    let proto = call.getString("protocol")
    let negotiated = call.getBool("negotiated") ?? false
    let id = call.getInt("id")
    
    let config = RTCDataChannelConfiguration()
    config.isOrdered = ordered
    if let maxPacketLifeTime = maxPacketLifeTime {
      config.maxPacketLifeTime = Int32(maxPacketLifeTime)
    }
    if let maxRetransmits = maxRetransmits {
      config.maxRetransmits = Int32(maxRetransmits)
    }
    if let proto = proto {
      config.protocol = proto
    }
    config.isNegotiated = negotiated
    if let id = id {
      config.channelId = Int32(id)
    }
    
    guard let channel = pc.dataChannel(forLabel: label, configuration: config) else {
      return call.reject("Failed to create data channel")
    }
    
    let channelId = label
    dataChannels[channelId] = channel
    let delegate = DataChannelDelegate(plugin: self, channelId: channelId)
    dataChannelDelegates[channelId] = delegate
    channel.delegate = delegate
    
    call.resolve(["channelId": channelId])
  }

  @objc func sendData(_ call: CAPPluginCall) {
    guard let channelId = call.getString("channelId") else {
      return call.reject("Missing channelId")
    }
    guard let channel = dataChannels[channelId] else {
      return call.reject("Unknown channelId")
    }

    let binary = call.getBool("binary") ?? false

    // Extract input in supported ways (string, array, or object)
    var payloadData: Data?

    if binary {
      // Expect base64 string or array of numbers for binary
      if let base64String = call.getString("data") {
        payloadData = Data(base64Encoded: base64String)
        if payloadData == nil {
          return call.reject("Invalid base64 string")
        }
      } else if let numberArray = call.getArray("data") as? [Int] {
        payloadData = Data(numberArray.map { UInt8($0 & 0xFF) })
      } else if let obj = call.getObject("data") { // try object with `base64` field
        if let base64String = obj["base64"] as? String, let decoded = Data(base64Encoded: base64String) {
          payloadData = decoded
        }
      }

      guard let bytes = payloadData else {
        return call.reject("Missing data")
      }

      let buffer = RTCDataBuffer(data: bytes, isBinary: true)
      channel.sendData(buffer)
    } else {
      // Text mode: accept string; if array/object provided, stringify it
      if let text = call.getString("data") {
        guard let textData = text.data(using: String.Encoding.utf8) else {
          return call.reject("Failed to encode text data")
        }
        let buffer = RTCDataBuffer(data: textData, isBinary: false)
        channel.sendData(buffer)
      } else if let arr = call.getArray("data") {
        let text = String(describing: arr)
        guard let textData = text.data(using: String.Encoding.utf8) else {
          return call.reject("Failed to encode text data")
        }
        let buffer = RTCDataBuffer(data: textData, isBinary: false)
        channel.sendData(buffer)
      } else if let obj = call.getObject("data") {
        let text = String(describing: obj)
        guard let textData = text.data(using: String.Encoding.utf8) else {
          return call.reject("Failed to encode text data")
        }
        let buffer = RTCDataBuffer(data: textData, isBinary: false)
        channel.sendData(buffer)
      } else {
        return call.reject("Missing data")
      }
    }
    call.resolve()
  }

  @objc func closeDataChannel(_ call: CAPPluginCall) {
    guard let channelId = call.getString("channelId") else {
      return call.reject("Missing channelId")
    }
    guard let channel = dataChannels.removeValue(forKey: channelId) else {
      return call.resolve()
    }
    channel.close()
    dataChannelDelegates.removeValue(forKey: channelId)
    call.resolve()
  }
}

// Helper class for DataChannel delegate
private class DataChannelDelegate: NSObject, RTCDataChannelDelegate {
  weak var plugin: CapWebRTCPlugin?
  let channelId: String
  
  init(plugin: CapWebRTCPlugin, channelId: String) {
    self.plugin = plugin
    self.channelId = channelId
  }
  
  func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
    plugin?.notifyListeners("dataChannelState", data: [
      "channelId": channelId,
      "state": stateToString(dataChannel.readyState)
    ])
  }
  
  func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
    let data: String
    if buffer.isBinary {
      data = buffer.data.base64EncodedString()
    } else {
      data = String(data: buffer.data, encoding: .utf8) ?? ""
    }
    
    plugin?.notifyListeners("dataChannelMessage", data: [
      "channelId": channelId,
      "data": data,
      "binary": buffer.isBinary
    ])
  }
  
  private func stateToString(_ state: RTCDataChannelState) -> String {
    switch state {
    case .connecting: return "connecting"
    case .open: return "open"
    case .closing: return "closing"
    case .closed: return "closed"
    @unknown default: return "unknown"
    }
  }
}

extension CapWebRTCPlugin: RTCPeerConnectionDelegate {
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

  public func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {
    let channelId = dataChannel.label
    dataChannels[channelId] = dataChannel
    let delegate = DataChannelDelegate(plugin: self, channelId: channelId)
    dataChannelDelegates[channelId] = delegate
    dataChannel.delegate = delegate
    
    notifyListeners("dataChannel", data: [
      "channelId": channelId,
      "label": channelId
    ])
  }
}

