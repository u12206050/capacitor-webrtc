# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2024-XX-XX

### Added
- Initial release
- **Web platform support**: Full WebRTC implementation using browser APIs
- Native WebRTC implementation for Android and iOS
- Receive-only video/audio support with native video overlay rendering
- Background audio support (iOS background audio + Android foreground service)
- Video pause/resume on background/foreground transitions
- DataChannel support for bidirectional data exchange
- User Media support (getUserMedia equivalent) for sending camera/microphone
- Full-duplex communication (send and receive simultaneously)
- Camera switching (front/back)
- Track management (add/remove/enable/disable)
- Device enumeration (audio/video input devices)
- Offer/Answer SDP negotiation
- ICE candidate handling
- Connection state monitoring
- Speakerphone control
- Helper function for attaching video to DOM elements

### Technical Details
- Android: Kotlin implementation with WebRTC library 1.0.32006
- iOS: Swift implementation with GoogleWebRTC CocoaPod ~> 1.1
- Minimum iOS: 13.0
- Minimum Android: API 22

