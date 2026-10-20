require 'xcodeproj'
project = Xcodeproj::Project.open('ios/Sovel.xcodeproj')
target = project.targets.find { |t| t.name == 'SovelUITests' }
unless target
  target = project.new_target(:ui_test_bundle, 'SovelUITests', :ios, '16.4')
  target.add_dependency(project.targets.find { |t| t.name == 'Sovel' })
  file = project.main_group.new_group('SovelUITests', 'SovelUITests').new_file('SovelUITests.swift')
  target.source_build_phase.add_file_reference(file)
end
target.build_configurations.each do |config|
  config.build_settings.merge!({'PRODUCT_NAME'=>'SovelUITests','GENERATE_INFOPLIST_FILE'=>'YES','PRODUCT_BUNDLE_IDENTIFIER'=>'cn.quguai.music.sovel.uitests','SWIFT_VERSION'=>'5.0','TEST_TARGET_NAME'=>'Sovel','TARGETED_DEVICE_FAMILY'=>'1,2','CODE_SIGNING_ALLOWED'=>'NO'})
end
project.save
scheme = Xcodeproj::XCScheme.new('ios/Sovel.xcodeproj/xcshareddata/xcschemes/Sovel.xcscheme')
REXML::XPath.match(scheme.doc, 'Scheme/TestAction/Testables/TestableReference').each { |element| element.parent.delete(element) }
scheme.add_test_target(target)
scheme.save_as('ios/Sovel.xcodeproj','Sovel')
