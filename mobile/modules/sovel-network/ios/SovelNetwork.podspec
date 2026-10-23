Pod::Spec.new do |s|
 s.name = 'SovelNetwork'
 s.version = '0.1.0'
 s.summary = 'LAN discovery and read-only SMB streaming for Sovel.'
 s.license = { :type => 'MIT' }
 s.author = 'Sovel'
 s.homepage = 'https://github.com/quguai/sovel-player'
 s.source = { :git => '' }
 s.platforms = { :ios => '16.4' }
 s.swift_version = '5.9'
 s.static_framework = true
 s.dependency 'ExpoModulesCore'
 s.dependency 'SovelSMBClient'
 s.source_files = 'Sovel*.swift'
 s.frameworks = 'Network'
 s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
