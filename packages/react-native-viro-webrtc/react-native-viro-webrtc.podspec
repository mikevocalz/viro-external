require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'ViroExternalWebRTC'
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = 'https://github.com/mikevocalz/viro-external'
  s.license      = { :type => 'MIT' }
  s.author       = 'ReactVision'
  s.source       = { :git => 'https://github.com/mikevocalz/viro-external.git' }
  s.requires_arc = true

  # FishjamReactNativeWebrtc currently declares iOS/macOS/tvOS but not visionOS.
  # The Viro core external-video backend itself supports visionOS; this adapter
  # will add xros as soon as Fishjam's native WebRTC pod does.
  s.platform = :ios, '15.1'
  s.source_files = 'ios/**/*.{h,m,mm}'
  s.frameworks = ['CoreVideo']

  s.dependency 'React-Core'
  s.dependency 'FishjamReactNativeWebrtc'
end
