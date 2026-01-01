require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'WebRTCReceiver'
  s.version = package['version']
  s.summary = package['description']&.slice(0, 140) || 'Capacitor plugin for WebRTC support with native video rendering'
  s.license = package['license']
  repo_url = package.dig('repository', 'url')
  if repo_url.nil? || repo_url.empty?
    # Fallback for local development/validation
    repo_url = 'https://github.com/capacitor-community/capacitor-webrtc-receiver'
  end
  s.homepage = repo_url
  s.author = package['author'] || ''
  s.source = { :git => repo_url, :tag => s.version.to_s }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target  = '14.0'
  s.dependency 'Capacitor'
  s.dependency 'GoogleWebRTC', '~> 1.1'
  s.swift_version = '5.1'
end

