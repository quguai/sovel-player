const { withPodfile } = require('expo/config-plugins');
module.exports = function withSovelNetwork(config) {
  return withPodfile(config, config => {
    const line = "  pod 'SovelSMBClient', :podspec => '../modules/sovel-network/ios/SovelSMBClient.podspec'";
    if (!config.modResults.contents.includes("pod 'SovelSMBClient'")) {
      if (!config.modResults.contents.includes('use_expo_modules!')) throw new Error('Cannot locate Expo modules in Podfile');
      config.modResults.contents = config.modResults.contents.replace('use_expo_modules!', 'use_expo_modules!\n' + line);
    }
    return config;
  });
};
