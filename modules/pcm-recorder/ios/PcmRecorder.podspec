Pod::Spec.new do |s|
  s.name = 'PcmRecorder'
  s.version = '0.1.0'
  s.summary = '16 kHz PCM capture for iFlytek IAT'
  s.description = 'Records mono 16-bit PCM for speech-to-text'
  s.author = 'kaibairen'
  s.homepage = 'https://github.com/kaibairen/cursor_browser_apk'
  s.license = 'MIT'
  s.platform = :ios, '15.1'
  s.source = { git: '' }
  s.static_framework = true
  s.source_files = '*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
