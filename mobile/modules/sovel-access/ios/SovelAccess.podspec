Pod::Spec.new do |s|
  s.name = 'SovelAccess'
  s.version = '0.1.0'
  s.summary = 'Open music in place and restore document access.'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Sovel'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.source = { :git => '' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
