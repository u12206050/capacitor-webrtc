#import <Capacitor/Capacitor.h>

// The CapWebRTCPlugin class is defined in the CapacitorWebrtc Swift module
// Swift classes marked with @objc are automatically bridged to Objective-C
CAP_PLUGIN(CapWebRTCPlugin, "CapWebRTC",
    CAP_PLUGIN_METHOD(start, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setRemoteDescription, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createAnswer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createOffer, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setLocalDescription, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(addIceCandidate, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setSpeakerphoneOn, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createVideoView, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateVideoView, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(destroyVideoView, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getUserMedia, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(addTrack, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(removeTrack, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getTracks, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setTrackEnabled, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(switchCamera, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getAudioInputDevices, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getVideoInputDevices, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(createDataChannel, CAPPluginReturnPromise);
)

