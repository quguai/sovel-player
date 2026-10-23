Pod::Spec.new do |s|
 s.name = 'SovelSMBClient'
 s.module_name = 'SMBClient'
 s.version = '0.1.0'
 s.summary = 'Pinned MIT Swift SMB2 client by Kishikawa Katsumi.'
 s.license = { :type => 'MIT', :file => 'LICENSE' }
 s.author = 'Kishikawa Katsumi'
 s.homepage = 'https://github.com/kishikawakatsumi/SMBClient'
 s.source = { :git => 'https://github.com/kishikawakatsumi/SMBClient.git', :commit => '66eafaa6d17e034e8036dee4b3ebc1b52cb53919' }
 s.platforms = { :ios => '16.4' }
 s.swift_version = '5.9'
 s.source_files = 'Sources/SMBClient/**/*.swift'
 s.frameworks = 'Network'
end
