// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "SovelNetworkChecks", platforms: [.macOS(.v12)], dependencies: [
  .package(url: "https://github.com/kishikawakatsumi/SMBClient.git", revision: "66eafaa6d17e034e8036dee4b3ebc1b52cb53919")
], targets: [
  .target(name: "NetworkCore", dependencies: [.product(name: "SMBClient", package: "SMBClient")], path: "ios", exclude: ["SovelNetworkModule.swift", "SovelNetwork.podspec", "SovelSMBClient.podspec"]),
  .testTarget(name: "NetworkChecks", dependencies: ["NetworkCore"], path: "tests/swift/Tests")
])
