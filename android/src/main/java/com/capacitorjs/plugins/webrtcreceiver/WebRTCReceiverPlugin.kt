package com.capacitorjs.plugins.capwebrtc

import android.content.Intent
import android.media.AudioManager
import android.view.View
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.webrtc.*
import android.Manifest
import android.content.pm.PackageManager

@CapacitorPlugin(name = "CapWebRTC")
class CapWebRTCPlugin : Plugin() {

  private var factory: PeerConnectionFactory? = null
  private var pc: PeerConnection? = null
  private var eglBase: EglBase? = null

  // Simple native overlay views registry
  private val views = mutableMapOf<String, SurfaceViewRenderer>()
  
  // DataChannel registry
  private val dataChannels = mutableMapOf<String, DataChannel>()
  
  // Local media tracks
  private val localTracks = mutableMapOf<String, MediaStreamTrack>()
  private var audioSource: AudioSource? = null
  private var videoSource: VideoSource? = null
  private var videoCapturer: VideoCapturer? = null
  private var currentFacingMode: String = "user" // "user" = front, "environment" = back

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
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
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
      override fun onDataChannel(channel: DataChannel) {
        val channelId = channel.label()
        dataChannels[channelId] = channel
        
        val data = JSObject()
        data.put("channelId", channelId)
        data.put("label", channel.label())
        notifyListeners("dataChannel", data)
        
        channel.registerObserver(object : DataChannel.Observer {
          override fun onBufferedAmountChange(p0: Long) {}
          
          override fun onStateChange() {
            val stateData = JSObject()
            stateData.put("channelId", channelId)
            stateData.put("state", channel.state().name)
            notifyListeners("dataChannelState", stateData)
          }
          
          override fun onMessage(buffer: DataChannel.Buffer) {
            val messageData = JSObject()
            messageData.put("channelId", channelId)
            
            if (buffer.binary) {
              // Send as base64 string for binary data
              val bytes = ByteArray(buffer.data.remaining())
              buffer.data.get(bytes)
              messageData.put("data", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP))
              messageData.put("binary", true)
            } else {
              // Text data
              val bytes = ByteArray(buffer.data.remaining())
              buffer.data.get(bytes)
              messageData.put("data", String(bytes, Charsets.UTF_8))
              messageData.put("binary", false)
            }
            notifyListeners("dataChannelMessage", messageData)
          }
        })
      }
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
    
    // close data channels
    dataChannels.values.forEach { it.close() }
    dataChannels.clear()
    
    // stop and release local tracks
    localTracks.values.forEach { it.dispose() }
    localTracks.clear()
    videoCapturer?.stopCapture()
    videoCapturer?.dispose()
    videoCapturer = null
    videoSource?.dispose()
    videoSource = null
    audioSource?.dispose()
    audioSource = null

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
  fun createOffer(call: PluginCall) {
    val constraints = MediaConstraints()
    constraints.mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
    constraints.mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))

    pc?.createOffer(object : SdpObserver {
      override fun onCreateSuccess(desc: SessionDescription) {
        pc?.setLocalDescription(SimpleSdpObserver {
          val res = JSObject()
          res.put("type", "offer")
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
  fun setLocalDescription(call: PluginCall) {
    val type = call.getString("type") ?: return call.reject("Missing type")
    val sdp = call.getString("sdp") ?: return call.reject("Missing sdp")
    val desc = SessionDescription(
      if (type == "offer") SessionDescription.Type.OFFER else SessionDescription.Type.ANSWER,
      sdp
    )
    pc?.setLocalDescription(SimpleSdpObserver { call.resolve() }, desc)
      ?: call.reject("PeerConnection not started")
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

  @PluginMethod
  fun createDataChannel(call: PluginCall) {
    val label = call.getString("label") ?: return call.reject("Missing label")
    val ordered = call.getBoolean("ordered", true)
    val maxPacketLifeTime = call.getInt("maxPacketLifeTime")
    val maxRetransmits = call.getInt("maxRetransmits")
    val protocol = call.getString("protocol")
    val negotiated = call.getBoolean("negotiated", false)
    val id = call.getInt("id")

    val init = DataChannel.Init()
    init.ordered = ordered
    maxPacketLifeTime?.let { init.maxPacketLifeTimeMs = it }
    maxRetransmits?.let { init.maxRetransmits = it }
    protocol?.let { init.protocol = it }
    init.negotiated = negotiated
    id?.let { init.id = it }

    val channel = pc?.createDataChannel(label, init) ?: return call.reject("PeerConnection not started")
    val channelId = channel.label()
    dataChannels[channelId] = channel

    // Register observer for this channel
    channel.registerObserver(object : DataChannel.Observer {
      override fun onBufferedAmountChange(p0: Long) {}
      
      override fun onStateChange() {
        val stateData = JSObject()
        stateData.put("channelId", channelId)
        stateData.put("state", channel.state().name)
        notifyListeners("dataChannelState", stateData)
      }
      
      override fun onMessage(buffer: DataChannel.Buffer) {
        val messageData = JSObject()
        messageData.put("channelId", channelId)
        
        if (buffer.binary) {
          val bytes = ByteArray(buffer.data.remaining())
          buffer.data.get(bytes)
          messageData.put("data", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP))
          messageData.put("binary", true)
        } else {
          val bytes = ByteArray(buffer.data.remaining())
          buffer.data.get(bytes)
          messageData.put("data", String(bytes, Charsets.UTF_8))
          messageData.put("binary", false)
        }
        notifyListeners("dataChannelMessage", messageData)
      }
    })

    call.resolve(JSObject().put("channelId", channelId))
  }

  @PluginMethod
  fun sendData(call: PluginCall) {
    val channelId = call.getString("channelId") ?: return call.reject("Missing channelId")
    val channel = dataChannels[channelId] ?: return call.reject("Unknown channelId")
    val binary = call.getBoolean("binary", false)

    val data = call.get("data")
    if (data == null) return call.reject("Missing data")

    try {
      if (binary) {
        // Handle binary data - expect base64 string or ArrayBuffer-like data
        val bytes = when (data) {
          is String -> {
            // Assume base64 encoded string
            android.util.Base64.decode(data, android.util.Base64.NO_WRAP)
          }
          is JSArray -> {
            // Array of numbers representing bytes
            data.toList().map { (it as? Number)?.toInt()?.toByte() ?: 0.toByte() }.toByteArray()
          }
          else -> return call.reject("Invalid binary data format")
        }
        val buffer = java.nio.ByteBuffer.wrap(bytes)
        channel.send(DataChannel.Buffer(buffer, true))
      } else {
        // Text data
        val text = when (data) {
          is String -> data
          else -> data.toString()
        }
        val buffer = java.nio.ByteBuffer.wrap(text.toByteArray(Charsets.UTF_8))
        channel.send(DataChannel.Buffer(buffer, false))
      }
      call.resolve()
    } catch (e: Exception) {
      call.reject("Failed to send data: ${e.message}")
    }
  }

  @PluginMethod
  fun closeDataChannel(call: PluginCall) {
    val channelId = call.getString("channelId") ?: return call.reject("Missing channelId")
    val channel = dataChannels.remove(channelId) ?: return call.resolve()
    channel.close()
    call.resolve()
  }

  @PluginMethod
  fun getUserMedia(call: PluginCall) {
    if (factory == null) return call.reject("Factory not initialized")
    
    val enableAudio = call.getBoolean("audio", true)
    val enableVideo = call.getBoolean("video", true)
    val facingMode = call.getString("facingMode") ?: "user"
    val audioDeviceId = call.getString("audioDeviceId")
    val videoDeviceId = call.getString("videoDeviceId")

    val tracks = mutableListOf<MediaStreamTrack>()
    val trackInfos = mutableListOf<JSObject>()

    try {
      // Create audio track
      if (enableAudio) {
        audioSource = factory!!.createAudioSource(MediaConstraints())
        val audioTrack = factory!!.createAudioTrack("audio_track_${System.currentTimeMillis()}", audioSource!!)
        localTracks[audioTrack.id()] = audioTrack
        tracks.add(audioTrack)
        
        val trackInfo = JSObject()
        trackInfo.put("trackId", audioTrack.id())
        trackInfo.put("kind", "audio")
        trackInfo.put("enabled", audioTrack.enabled())
        trackInfos.add(trackInfo)
      }

      // Create video track
      if (enableVideo) {
        val cameraEnumerator: CameraEnumerator = if (Camera2Enumerator.isSupported(context)) {
          Camera2Enumerator(context)
        } else {
          Camera1Enumerator(false)
        }
        val deviceNames = cameraEnumerator.deviceNames
        
        var cameraName: String? = null
        if (videoDeviceId != null) {
          // Find camera by device ID
          cameraName = videoDeviceId
        } else {
          // Use facing mode
          for (name in deviceNames) {
            val isFrontFacing = cameraEnumerator.isFrontFacing(name)
            if ((facingMode == "user" && isFrontFacing) || (facingMode == "environment" && !isFrontFacing)) {
              cameraName = name
              break
            }
          }
        }
        
        if (cameraName == null && deviceNames.isNotEmpty()) {
          cameraName = deviceNames[0] // Fallback to first available
        }
        
        if (cameraName != null) {
          videoCapturer = cameraEnumerator.createCapturer(cameraName, null)
          videoSource = factory!!.createVideoSource(false)
          val surfaceTextureHelper = SurfaceTextureHelper.create("VideoSource", eglBase!!.eglBaseContext)
          videoCapturer!!.initialize(surfaceTextureHelper, context, videoSource!!.capturerObserver)
          videoCapturer!!.startCapture(1280, 720, 30)
          
          val videoTrack = factory!!.createVideoTrack("video_track_${System.currentTimeMillis()}", videoSource!!)
          localTracks[videoTrack.id()] = videoTrack
          tracks.add(videoTrack)
          
          val trackInfo = JSObject()
          trackInfo.put("trackId", videoTrack.id())
          trackInfo.put("kind", "video")
          trackInfo.put("enabled", videoTrack.enabled())
          trackInfos.add(trackInfo)
          
          currentFacingMode = facingMode
        }
      }

      val result = JSObject()
      result.put("tracks", JSArray().apply { trackInfos.forEach { put(it) } })
      call.resolve(result)
    } catch (e: Exception) {
      call.reject("Failed to get user media: ${e.message}")
    }
  }

  @PluginMethod
  fun addTrack(call: PluginCall) {
    val trackId = call.getString("trackId") ?: return call.reject("Missing trackId")
    val track = localTracks[trackId] ?: return call.reject("Unknown trackId")
    
    val sender = when (track.kind()) {
      MediaStreamTrack.MEDIA_TRACK_TYPE_AUDIO -> {
        pc?.addTrack(track as AudioTrack, listOf())
      }
      MediaStreamTrack.MEDIA_TRACK_TYPE_VIDEO -> {
        pc?.addTrack(track as VideoTrack, listOf())
      }
      else -> null
    }
    
    if (sender == null) {
      call.reject("Failed to add track to peer connection")
    } else {
      call.resolve()
    }
  }

  @PluginMethod
  fun removeTrack(call: PluginCall) {
    val trackId = call.getString("trackId") ?: return call.reject("Missing trackId")
    val track = localTracks[trackId] ?: return call.reject("Unknown trackId")
    
    val senders = pc?.senders ?: emptyList()
    for (sender in senders) {
      if (sender.track()?.id() == trackId) {
        pc?.removeTrack(sender)
        call.resolve()
        return
      }
    }
    call.reject("Track not found in peer connection")
  }

  @PluginMethod
  fun getTracks(call: PluginCall) {
    val trackInfos = localTracks.values.map { track ->
      val info = JSObject()
      info.put("trackId", track.id())
      info.put("kind", if (track.kind() == MediaStreamTrack.MEDIA_TRACK_TYPE_AUDIO) "audio" else "video")
      info.put("enabled", track.enabled())
      info.put("muted", !track.enabled())
      info
    }
    
    val result = JSObject()
    result.put("tracks", JSArray().apply { trackInfos.forEach { put(it) } })
    call.resolve(result)
  }

  @PluginMethod
  fun setTrackEnabled(call: PluginCall) {
    val trackId = call.getString("trackId") ?: return call.reject("Missing trackId")
    val enabled = call.getBoolean("enabled", true)
    val track = localTracks[trackId] ?: return call.reject("Unknown trackId")
    
    track.setEnabled(enabled)
    call.resolve()
  }

  @PluginMethod
  fun switchCamera(call: PluginCall) {
    if (videoCapturer == null || videoSource == null) {
      return call.reject("No video track active")
    }
    
    val newFacingMode = if (currentFacingMode == "user") "environment" else "user"
    val cameraEnumerator: CameraEnumerator = if (Camera2Enumerator.isSupported(context)) {
      Camera2Enumerator(context)
    } else {
      Camera1Enumerator(false)
    }
    val deviceNames = cameraEnumerator.deviceNames
    
    var cameraName: String? = null
    for (name in deviceNames) {
      val isFrontFacing = cameraEnumerator.isFrontFacing(name)
      if ((newFacingMode == "user" && isFrontFacing) || (newFacingMode == "environment" && !isFrontFacing)) {
        cameraName = name
        break
      }
    }
    
    if (cameraName != null) {
      videoCapturer!!.stopCapture()
      videoCapturer!!.dispose()
      videoCapturer = cameraEnumerator.createCapturer(cameraName, null)
      val surfaceTextureHelper = SurfaceTextureHelper.create("VideoSource", eglBase!!.eglBaseContext)
      videoCapturer!!.initialize(surfaceTextureHelper, context, videoSource!!.capturerObserver)
      videoCapturer!!.startCapture(1280, 720, 30)
      currentFacingMode = newFacingMode
      call.resolve()
    } else {
      call.reject("Camera not found")
    }
  }

  @PluginMethod
  fun getAudioInputDevices(call: PluginCall) {
    // Android doesn't have a simple API for audio input devices
    // Return a default device
    val devices = JSArray()
    val device = JSObject()
    device.put("deviceId", "default")
    device.put("label", "Default Audio Input")
    devices.put(device)
    
    val result = JSObject()
    result.put("devices", devices)
    call.resolve(result)
  }

  @PluginMethod
  fun getVideoInputDevices(call: PluginCall) {
    val cameraEnumerator: CameraEnumerator = if (Camera2Enumerator.isSupported(context)) {
      Camera2Enumerator(context)
    } else {
      Camera1Enumerator(false)
    }
    val deviceNames = cameraEnumerator.deviceNames
    
    val devices = JSArray()
    for (name in deviceNames) {
      val device = JSObject()
      device.put("deviceId", name)
      device.put("label", if (cameraEnumerator.isFrontFacing(name)) "Front Camera" else "Back Camera")
      devices.put(device)
    }
    
    val result = JSObject()
    result.put("devices", devices)
    call.resolve(result)
  }
}

private class SimpleSdpObserver(val onSuccess: () -> Unit) : SdpObserver {
  override fun onSetSuccess() = onSuccess()
  override fun onSetFailure(p0: String) {}
  override fun onCreateSuccess(p0: SessionDescription) {}
  override fun onCreateFailure(p0: String) {}
}

