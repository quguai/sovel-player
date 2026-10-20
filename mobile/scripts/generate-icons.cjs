// Export the selected B artwork using the same image pipeline as Expo Prebuild.
// This updates icons only, preserving the project's custom native modules.
const fs = require("node:fs/promises");
const path = require("node:path");
const {
  generateImageAsync,
  createSquareAsync,
  compositeImagesAsync,
} = require("@expo/image-utils");
const {
  setIconsAsync,
} = require("@expo/prebuild-config/build/plugins/icons/withIosIcons");
const {
  setIconAsync,
} = require("@expo/prebuild-config/build/plugins/icons/withAndroidIcons");

const projectRoot = path.resolve(__dirname, "..");
async function exportPng(src, destination, size, options = {}) {
  const { padding = 0, ...imageOptions } = options;
  const { source } = await generateImageAsync(
    { projectRoot, cacheType: "sovel-brand-b" },
    {
      src: path.join(projectRoot, src),
      width: size - padding * 2,
      height: size - padding * 2,
      resizeMode: "contain",
      ...imageOptions,
    },
  );
  const output = padding
    ? await compositeImagesAsync({
        foreground: source,
        background: await createSquareAsync({ size, color: "#00000000" }),
        x: padding,
        y: padding,
      })
    : source;
  await fs.writeFile(path.join(projectRoot, destination), output);
}

async function main() {
  process.chdir(projectRoot);
  const master = "assets/brand/icon-master.png";
  await exportPng(master, "assets/icon.png", 1024, {
    removeTransparency: true,
  });
  await exportPng(master, "assets/favicon.png", 48, {
    removeTransparency: true,
  });
  // Android reveals the central 72 dp of a 108 dp layer. These margins keep
  // the waveform inside the safe area and match its apparent iOS size.
  await exportPng(
    "assets/brand/foreground-master.png",
    "assets/android-icon-foreground.png",
    1024,
    {
      padding: 174,
      backgroundColor: "transparent",
    },
  );
  const { expo: config } = JSON.parse(
    await fs.readFile(path.join(projectRoot, "app.json"), "utf8"),
  );
  await setIconsAsync(config, projectRoot);
  await setIconAsync(projectRoot, {
    icon: config.icon,
    ...config.android.adaptiveIcon,
    backgroundImage: null,
    isAdaptive: true,
  });
  // The Android monochrome drawable consumes only the foreground alpha mask.
  // Export the separate HTML demo's icons when running in the full workspace.
  const demoAssets = path.resolve(projectRoot, "../assets");
  if (
    await fs.stat(demoAssets).then(
      (s) => s.isDirectory(),
      () => false,
    )
  ) {
    await fs.copyFile(
      path.join(projectRoot, "assets/favicon.png"),
      path.join(demoAssets, "favicon.png"),
    );
    await exportPng(master, "../assets/apple-touch-icon.png", 180, {
      removeTransparency: true,
    });
  }
  console.log("Sovel B icons exported for iOS, Android and web.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
