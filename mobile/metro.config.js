const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("flac", "dsf", "dff");
// Select the portable entry points; the node condition uses node:fs/streams.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const portable = {
    "music-metadata": "music-metadata/lib/core.js",
    strtok3: "strtok3/lib/core.js",
  };
  if (portable[moduleName])
    return {
      type: "sourceFile",
      filePath: path.join(__dirname, "node_modules", portable[moduleName]),
    };
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
