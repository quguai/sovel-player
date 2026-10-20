import XCTest

final class SovelUITests: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "cn.quguai.music.sovel")
  override func setUpWithError() throws {
    try super.setUpWithError()
    // Expo BlurView holds a UIKit animator at a fractional progress value.
    // Use its built-in UI-test guard so XCTest can idle between interactions.
    // This changes only blur intensity interpolation in the test process.
    app.launchArguments += ["-detoxServer", "-detoxSessionId"]
  }
  func element(_ label: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: label).firstMatch }
  func tap(_ label: String, timeout: TimeInterval = 15) {
    let item = element(label)
    XCTAssertTrue(item.waitForExistence(timeout: timeout), "Missing: \(label)\n\(app.debugDescription)")
    for _ in 0..<7 {
      if item.isHittable { break }
      if label.hasPrefix("返回") || item.frame.midY < app.frame.midY { app.swipeDown() } else { app.swipeUp() }
    }
    item.tap()
  }
  func assertClockAdvanced(_ seconds: Int = 2) {
    let condition = NSPredicate { _,_ in
      guard let value=self.element("播放进度").value as? String else { return false }
      let parts=value.split(separator:":").compactMap { Int($0) }
      return parts.count == 2 && parts[0]*60+parts[1] >= seconds
    }
    XCTAssertEqual(XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:condition,object:app)],timeout:15),.completed,app.debugDescription)
  }
  func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
  func testUpdateSettingsOnIOS() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch(); tap("设置", timeout: 30); tap("版本更新")
    XCTAssertTrue(app.staticTexts["Sovel HiFi"].exists)
    XCTAssertTrue(element("查看 GitHub 发布记录").exists)
    XCTAssertFalse(element("下载更新").exists)
    capture("updates-ios-channel")
    tap("返回设置")
    XCTAssertTrue(element("关于 Sovel HiFi").exists)
  }
  func testListeningHistoryCoverageAndBackground() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch(); tap("设置", timeout: 30)
    let background = app.switches["后台播放"]
    if background.value as? String != "1" { background.tap() }
    tap("返回音乐库"); tap("按专辑浏览"); tap("打开 声音手记")
    tap("播放 初见"); assertClockAdvanced(4); tap("暂停")
    tap("查看完整歌词"); tap("播放到：让余音慢慢散去")
    tap("返回音乐库"); tap("设置"); tap("听歌记录与偏好")
    let entries = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "初见，实际听了 "))
    let first = entries.firstMatch
    XCTAssertTrue(first.waitForExistence(timeout: 10), app.debugDescription)
    let label = first.label
    let percent = Int(label.components(separatedBy: "完成率 ").last!.replacingOccurrences(of: "%", with: ""))!
    XCTAssertGreaterThan(percent, 5)
    XCTAssertLessThan(percent, 70, "Seeking near the end must not imply completion")
    capture("listening-actual-coverage")
    app.terminate(); app.launch(); tap("设置", timeout: 30); tap("听歌记录与偏好")
    XCTAssertTrue(element(label).waitForExistence(timeout: 10), "History must survive process restart")
    tap("返回设置"); tap("返回音乐库"); tap("按专辑浏览"); tap("打开 声音手记")
    tap("播放 初见"); assertClockAdvanced(2)
    XCUIDevice.shared.press(.home)
    Thread.sleep(forTimeInterval: 8)
    app.activate(); tap("暂停"); tap("返回音乐库"); tap("设置"); tap("听歌记录与偏好")
    XCTAssertTrue(first.waitForExistence(timeout: 10))
    let seconds = Int(first.label.components(separatedBy: "实际听了 ").last!.components(separatedBy: " 秒").first!)!
    XCTAssertGreaterThanOrEqual(seconds, 8, "Native background playback must contribute listening time")
    capture("listening-background-record")
  }
  func testLibraryCategoryHeaderStaysAligned() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    tap("按专辑浏览", timeout: 30)
    let tabsY = element("按专辑浏览").frame.minY
    for category in ["歌曲", "艺术家", "文件夹", "专辑"] {
      tap("按\(category)浏览")
      XCTAssertEqual(element("按专辑浏览").frame.minY, tabsY, accuracy: 1)
      XCTAssertTrue(element("音乐精选卡片").exists)
      XCTAssertTrue(element("打开播放页面").exists)
      capture("library-aligned-\(category)")
    }
  }
  func testLibraryDiscoveryShelf() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch(); tap("按专辑浏览", timeout: 30)
    capture("discovery-home")
    tap("每日精选"); XCTAssertTrue(element("返回全部音乐").exists)
    XCTAssertTrue(element("播放 初见").exists); XCTAssertTrue(element("播放 微光").exists)
    capture("discovery-daily-mix")
    tap("返回全部音乐"); tap("按专辑浏览")
    element("音乐精选卡片").swipeLeft()
    element("音乐精选卡片").swipeLeft()
    tap("猜你喜欢")
    XCTAssertTrue(element("返回全部音乐").exists)
    capture("discovery-related-mix")
    let cardX = element("猜你喜欢").frame.minX
    tap("按艺术家浏览")
    XCTAssertEqual(element("猜你喜欢").frame.minX, cardX, accuracy: 2)
    capture("discovery-artists")
    tap("按专辑浏览")
    XCUIDevice.shared.orientation = .landscapeLeft
    let landscape = NSPredicate { _, _ in
      self.app.frame.width > self.app.frame.height && self.element("音乐精选卡片").frame.width > 500
    }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: landscape, object: app)], timeout: 6), .completed)
    capture("discovery-landscape")
    XCUIDevice.shared.orientation = .portrait
  }
  func testQueueModePreservesPosition() {
    continueAfterFailure = false
    app.launch(); tap("设置", timeout: 30); tap("高级设置"); tap("列表循环")
    tap("返回设置"); tap("返回音乐库"); tap("按专辑浏览"); tap("打开 声音手记")
    tap("播放 初见"); tap("暂停"); tap("查看完整歌词"); tap("播放到：让时间慢一点"); tap("正在播放")
    let before = element("播放进度").value as? String
    func assertRestoredPosition() {
      let restored = NSPredicate { _, _ in self.element("播放进度").value as? String == before }
      XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: restored, object: app)], timeout: 5), .completed)
    }
    tap("列表循环，点击切换播放方式"); tap("单曲循环，点击切换播放方式")
    XCTAssertTrue(element("随机播放，点击切换播放方式").waitForExistence(timeout: 5))
    assertRestoredPosition()
    tap("随机播放，点击切换播放方式")
    assertRestoredPosition()
    app.terminate(); app.launch(); tap("打开播放页面", timeout: 30)
    assertRestoredPosition()
    XCTAssertTrue(element("播放").exists)
  }
  func testSessionLyricsAndCollectionViews() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    tap("按专辑浏览", timeout: 30)
    if element("专辑切换为卡片").exists { tap("专辑切换为卡片") }
    capture("collections-album-cards")
    tap("专辑切换为列表"); capture("collections-album-list")
    tap("按艺术家浏览")
    if element("艺术家切换为卡片").exists { tap("艺术家切换为卡片") }
    capture("collections-artist-cards")
    tap("艺术家切换为列表"); capture("collections-artist-list")
    tap("按专辑浏览")
    XCTAssertTrue(element("专辑切换为卡片").exists)
    tap("打开 声音手记"); tap("播放 初见"); tap("暂停")
    tap("查看完整歌词"); tap("调整本曲歌词同步")
    tap("重置偏移"); tap("提前 0.2 秒"); tap("提前 0.2 秒")
    tap("播放到：让时间慢一点")
    XCTAssertTrue(app.staticTexts["0:07"].waitForExistence(timeout: 5), app.debugDescription)
    capture("lyrics-offset")
    app.terminate(); app.launch(); tap("打开播放页面", timeout: 30)
    XCTAssertTrue(element("播放").exists, "Restoration must stay paused")
    XCTAssertTrue(app.staticTexts["0:07"].waitForExistence(timeout: 5), app.debugDescription)
    tap("查看完整歌词")
    XCTAssertEqual(element("调整本曲歌词同步").value as? String, "0.4 秒")
    tap("正在播放"); tap("下一首")
    XCTAssertTrue(app.staticTexts["微光"].firstMatch.waitForExistence(timeout: 5), app.debugDescription)
    tap("上一首"); tap("返回音乐库"); tap("按专辑浏览")
    XCTAssertTrue(element("专辑切换为卡片").exists)
    tap("按艺术家浏览"); XCTAssertTrue(element("艺术家切换为卡片").exists)
    tap("艺术家切换为卡片"); tap("按专辑浏览"); tap("专辑切换为卡片")
    capture("collections-restored")
  }
  func testNativeSleepInBackground() {
    continueAfterFailure = false
    app.launch(); tap("设置", timeout: 30)
    let background = app.switches["后台播放"]
    if background.value as? String != "1" { background.tap() }
    tap("高级设置"); tap("列表循环"); tap("返回设置")
    tap("返回音乐库"); tap("按歌曲浏览"); tap("播放 初见")
    assertClockAdvanced(2); tap("返回音乐库"); tap("设置"); tap("定时时长")
    let minutes = app.textFields["定时分钟数"]
    XCTAssertTrue(minutes.waitForExistence(timeout: 5)); minutes.tap()
    minutes.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 3) + "1")
    app.swipeUp(); tap("开始自定义定时")
    if !app.staticTexts["约 1 分钟后暂停"].exists { tap("开始自定义定时") }
    XCTAssertTrue(app.staticTexts["约 1 分钟后暂停"].waitForExistence(timeout: 5), app.debugDescription)
    capture("native-sleep-active")
    XCUIDevice.shared.press(.home)
    Thread.sleep(forTimeInterval: 64)
    app.activate()
    XCTAssertTrue(app.staticTexts["到时由原生播放器暂停，切歌不重置计时"].waitForExistence(timeout: 5), app.debugDescription)
    tap("返回设置"); tap("返回音乐库"); tap("打开播放页面")
    XCTAssertTrue(element("播放").exists, "Native timer must pause in the background")
    capture("native-sleep-complete")
  }
  func testSettingsBackupExport() {
    continueAfterFailure = false
    app.launch(); tap("设置", timeout: 30); tap("备份与恢复")
    capture("settings-backup")
    tap("导出设置备份")
    XCTAssertTrue(element("ActivityListView").waitForExistence(timeout: 8), app.debugDescription)
    capture("settings-backup-share")
    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)).tap()
    tap("选择备份文件")
    tap("浏览", timeout: 15)
    let phone=app.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS %@", "iPhone")).firstMatch
    XCTAssertTrue(phone.waitForExistence(timeout:10),app.debugDescription);phone.tap()
    let folder=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@ AND NOT label CONTAINS %@", "Sovel", "Test")).firstMatch
    XCTAssertTrue(folder.waitForExistence(timeout:10),app.debugDescription);folder.tap()
    let fixture=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@", "Restore-fixture")).firstMatch
    XCTAssertTrue(fixture.waitForExistence(timeout:10),app.debugDescription);fixture.tap()
    XCTAssertTrue(element("恢复这些设置").waitForExistence(timeout:10),app.debugDescription)
    capture("settings-backup-preview")
    tap("恢复这些设置")
    XCTAssertTrue(app.staticTexts["设置与预设已恢复"].waitForExistence(timeout:10),app.debugDescription)
    tap("返回设置");tap("返回音乐库");tap("按专辑浏览")
    XCTAssertTrue(element("专辑切换为卡片").exists)
    tap("专辑切换为卡片")
  }
  func scanListeningFixtures() {
    tap("设置", timeout: 30); tap("文件扫描"); tap("增量扫描")
    XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "最近扫描")).firstMatch.waitForExistence(timeout: 15), app.debugDescription)
    tap("返回设置"); tap("返回音乐库")
    XCTAssertTrue(element("打开播放页面").waitForExistence(timeout: 10), "Seed the simulator with scripts/prepare-listening-fixtures.sh before playback UI tests")
  }
  func testLocalLibraryAndPlayback() throws {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    XCTAssertTrue(element("设置").waitForExistence(timeout: 30))
    scanListeningFixtures()
    XCTAssertTrue(element("打开播放页面").waitForExistence(timeout: 30), app.debugDescription)
    capture("01-library")
    tap("按歌曲浏览");tap("播放 初见");tap("暂停")
    selectPlayerStyle("专辑封面")
    tap("播放")
    XCTAssertTrue(element("暂停").waitForExistence(timeout: 15), app.debugDescription)
    // The real native audio clock must advance; fake progress cannot satisfy this.
    assertClockAdvanced(3)
    capture("02-player")
    tap("查看音频文件信息")
    XCTAssertTrue(app.staticTexts["44,100 Hz"].waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["16 bit"].exists)
    capture("09-metadata")
    tap("返回播放页面")
    tap("下一首")
    XCTAssertTrue(app.staticTexts["微光"].firstMatch.waitForExistence(timeout: 10))
    assertClockAdvanced()
    tap("上一首")
    selectPlayerStyle("唱片")
    capture("03-vinyl")
    if element("喜欢这首歌").exists { tap("喜欢这首歌") }
    // A 24-second fixture may finish while XCTest navigates the appearance panel.
    if element("暂停").exists { tap("暂停") }
    tap("查看完整歌词")
    XCTAssertTrue(element("播放到：听见，属于自己的声音").waitForExistence(timeout: 10))
    capture("04-lyrics")
    tap("播放到：让时间慢一点")
    XCTAssertTrue(app.staticTexts["0:08"].waitForExistence(timeout: 5))
    tap("正在播放")
    XCUIDevice.shared.orientation = .landscapeLeft
    Thread.sleep(forTimeInterval: 1.2)
    capture("05-landscape")
    XCUIDevice.shared.orientation = .portrait
    tap("返回音乐库")
    tap("设置")
    capture("06-settings")
    tap("文件扫描")
    tap("全量扫描")
    XCTAssertTrue(app.staticTexts.containing(NSPredicate(format:"label CONTAINS %@", "最近扫描")).firstMatch.waitForExistence(timeout: 15), app.debugDescription)
    capture("07-scan")
    tap("返回设置"); tap("返回音乐库")
    app.terminate(); app.launch()
    tap("打开播放页面", timeout: 30)
    tap("打开播放外观"); XCTAssertTrue(element("播放画面：唱片").isSelected); tap("收起播放外观面板")
    XCTAssertTrue(element("取消喜欢").exists)
    capture("08-restored")
  }
  func testZReferencePicker() throws {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    tap("设置",timeout:30);tap("文件扫描")
    if !element("External Music").exists {
    tap("添加音乐文件夹")
    tap("浏览",timeout:20)
    let phone=app.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS %@", "iPhone")).firstMatch
    XCTAssertTrue(phone.waitForExistence(timeout:10),app.debugDescription);phone.tap()
    let fixture=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@", "Sovel Test Library")).firstMatch
    XCTAssertTrue(fixture.waitForExistence(timeout:10),app.debugDescription);fixture.tap()
    let folder=app.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH %@", "External Music")).firstMatch
    XCTAssertTrue(folder.waitForExistence(timeout:10),app.debugDescription);folder.tap()
    tap("打开")
    }
    tap("增量扫描"); tap("已连接的来源")
    XCTAssertTrue(app.staticTexts["1 首 · 引用原文件"].waitForExistence(timeout:15),app.debugDescription)
    capture("10-reference-source")
    tap("全量扫描")
    tap("返回设置");tap("返回音乐库");tap("按歌曲浏览");tap("播放 Reference")
    assertClockAdvanced()
    tap("暂停");tap("查看音频文件信息");app.swipeUp()
    XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "/External Music/Reference.wav")).firstMatch.waitForExistence(timeout:5),app.debugDescription)
    capture("11-reference-metadata")
    app.terminate();app.launch();tap("打开播放页面",timeout:30);tap("播放")
    XCTAssertTrue(app.staticTexts["Reference"].firstMatch.exists)
    assertClockAdvanced()
    tap("暂停");capture("12-reference-restored")
  }

  func testLandscapeLayout() {
    app.launch();tap("打开播放页面",timeout:30)
    XCUIDevice.shared.orientation = .landscapeLeft
    let landscape = NSPredicate { _, _ in self.app.frame.width > self.app.frame.height }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: landscape, object: app)], timeout: 6), .completed, "App must actually rotate into landscape")
    let play=element("播放")
    XCTAssertTrue(play.isHittable)
    XCTAssertTrue(element("播放队列").isHittable)
    capture("landscape-screen")
    XCUIDevice.shared.orientation = .portrait
  }

  func testPlaybackPreferencesAndTonearm() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    if !element("打开播放页面").waitForExistence(timeout: 3) { scanListeningFixtures() }
    tap("设置", timeout: 30); tap("高级设置"); tap("单曲循环"); tap("返回设置")
    let background = app.switches["后台播放"]
    XCTAssertTrue(background.exists)
    if background.value as? String == "1" { background.tap() }
    tap("定时时长"); tap("睡眠定时 30 分钟")
    XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "30 分钟后暂停")).firstMatch.exists)
    capture("playback-preferences")
    app.switches["定时停止播放"].tap()
    tap("返回设置"); tap("返回音乐库"); tap("打开播放页面")
    XCTAssertTrue(element("单曲循环，点击切换播放方式").exists)
    selectPlayerStyle("唱片")
    if element("播放").exists { tap("播放") }
    assertClockAdvanced(3)
    capture("tonearm-tracking")
    XCUIDevice.shared.press(.home)
    Thread.sleep(forTimeInterval: 2)
    app.activate()
    XCTAssertTrue(element("播放").waitForExistence(timeout: 5), "Background playback disabled must pause")
    capture("tonearm-parked")
    app.terminate(); app.launch()
    tap("打开播放页面", timeout: 30)
    XCTAssertTrue(element("单曲循环，点击切换播放方式").exists)
    tap("返回音乐库"); tap("设置")
    XCTAssertEqual(app.switches["后台播放"].value as? String, "0")
    app.switches["后台播放"].tap()
    tap("高级设置"); tap("列表循环")
    tap("返回设置"); tap("返回音乐库"); tap("打开播放页面"); tap("播放")
    assertClockAdvanced(2)
    XCUIDevice.shared.press(.home)
    Thread.sleep(forTimeInterval: 3)
    app.activate()
    XCTAssertTrue(element("暂停").waitForExistence(timeout: 5), "Background playback enabled must continue")
    XCUIDevice.shared.orientation = .landscapeLeft
    Thread.sleep(forTimeInterval: 1)
    capture("tonearm-landscape")
    tap("暂停")
    XCUIDevice.shared.orientation = .portrait
  }

  func selectPlayerStyle(_ name: String) {
    tap("打开播放外观"); tap("播放画面：\(name)"); tap("收起播放外观面板")
  }
  func assertPlayerHeaderStaysAnchored() {
    let button = element("打开播放外观").frame
    let indicatorFrame = element("player-page-indicator").frame
    for mode in ["沉浸大图", "专辑封面", "唱片"] {
      selectPlayerStyle(mode)
      XCTAssertTrue(element("正在播放").isSelected)
      XCTAssertEqual(element("打开播放外观").frame.minX, button.minX, accuracy: 0.5)
      XCTAssertEqual(element("打开播放外观").frame.minY, button.minY, accuracy: 0.5)
      XCTAssertEqual(element("player-page-indicator").frame.midX, indicatorFrame.midX, accuracy: 0.5)
      XCTAssertEqual(element("player-page-indicator").frame.minY, indicatorFrame.minY, accuracy: 0.5)
    }
  }
  func assertPlayerPage(_ label: String) {
    let selected = NSPredicate(format: "selected == true")
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: selected, object: element(label))], timeout: 4), .completed, app.debugDescription)
  }
  func testPlayerPagesAndAppearance() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch(); tap("打开播放页面", timeout: 30)
    assertPlayerPage("正在播放")
    let transportFrame = element("playback-controls").frame
    XCTAssertLessThan(element("player-page-indicator").frame.width, 54)
    let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.4))
    let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.4))
    from.press(forDuration: 0.05, thenDragTo: to)
    assertPlayerPage("完整歌词")
    XCTAssertTrue(element("上一首").isHittable)
    XCTAssertTrue(element("下一首").isHittable)
    XCTAssertTrue(element("播放队列").isHittable)
    XCTAssertEqual(element("playback-controls").frame.minY, transportFrame.minY, accuracy: 1)
    capture("pages-lyrics")
    to.press(forDuration: 0.05, thenDragTo: from)
    assertPlayerPage("正在播放")
    to.press(forDuration: 0.05, thenDragTo: from)
    assertPlayerPage("歌曲详情")
    XCTAssertTrue(app.staticTexts["猜你喜欢"].exists)
    XCTAssertTrue(element("上一首").isHittable)
    XCTAssertTrue(element("下一首").isHittable)
    XCTAssertTrue(element("播放队列").isHittable)
    XCTAssertEqual(element("playback-controls").frame.minY, transportFrame.minY, accuracy: 1)
    capture("pages-about")
    tap("查看歌手：Sovel")
    XCTAssertTrue(app.staticTexts["歌手专辑"].exists)
    let albumCard = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "打开专辑：声音手记，")).firstMatch
    XCTAssertTrue(albumCard.exists)
    albumCard.tap()
    XCTAssertTrue(app.staticTexts["专辑曲目"].exists)
    tap("返回歌手专辑")
    XCTAssertTrue(app.staticTexts["歌手专辑"].exists)
    tap("查看专辑：声音手记")
    XCTAssertTrue(app.staticTexts["专辑曲目"].exists)
    tap("返回歌曲信息")
    let detailScroll = element("song-details-scroll")
    detailScroll.swipeUp()
    XCTAssertTrue(app.staticTexts["文件路径"].exists)
    XCTAssertTrue(app.staticTexts["修改时间"].exists)
    XCTAssertFalse(app.staticTexts["访问地址"].exists)
    XCTAssertFalse(app.staticTexts["存储方式"].exists)
    XCTAssertLessThan(app.staticTexts["猜你喜欢"].firstMatch.frame.minY, app.staticTexts["文件信息"].firstMatch.frame.minY)
    capture("pages-file-info")
    tap("正在播放")
    selectPlayerStyle("唱片")
    assertPlayerHeaderStaysAnchored()
    tap("打开播放外观")
    capture("pages-appearance")
    tap("收起播放外观面板")
    tap("歌曲详情")
    XCUIDevice.shared.orientation = .landscapeLeft
    Thread.sleep(forTimeInterval: 1)
    assertPlayerPage("歌曲详情")
    capture("pages-about-landscape")
    tap("完整歌词")
    assertPlayerPage("完整歌词")
    tap("正在播放")
    XCTAssertTrue(element("播放").isHittable)
    capture("pages-player-landscape")
    XCUIDevice.shared.orientation = .portrait
  }

  func testSettingsScanRulesAndCapabilities() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    tap("设置", timeout: 30)
    capture("settings-root-compact")
    tap("均衡器")
    XCTAssertTrue(app.switches["启用均衡器"].isEnabled)
    tap("返回设置"); tap("PEQ")
    XCTAssertFalse(app.switches["PEQ 尚未接入"].isEnabled)
    tap("返回设置"); tap("定时时长"); tap("睡眠定时 30 分钟")
    XCTAssertEqual(app.switches["定时停止播放"].value as? String, "1")
    app.switches["定时停止播放"].tap()
    tap("返回设置"); tap("文件扫描")
    capture("scan-rules-default")
    let small = app.switches["过滤小文件"]
    XCTAssertTrue(small.waitForExistence(timeout: 5))
    if small.value as? String == "0" { small.tap() }
    XCTAssertTrue(element("最小文件大小 KB").exists)
    capture("scan-rules-size")
    app.terminate(); app.launch()
    tap("设置", timeout: 30); tap("文件扫描")
    XCTAssertEqual(app.switches["过滤小文件"].value as? String, "1")
    app.switches["过滤小文件"].tap()
    tap("全量扫描")
    XCTAssertTrue(app.staticTexts["扫描完成"].waitForExistence(timeout: 30), app.debugDescription)
    tap("增量扫描")
    XCTAssertTrue(app.staticTexts["扫描完成"].waitForExistence(timeout: 30), app.debugDescription)
    app.swipeUp()
    capture("scan-results")
    tap("返回设置"); tap("高级设置")
    app.swipeUp()
    XCTAssertTrue(app.staticTexts["耳机拔出暂停"].exists)
    capture("advanced-audio-capabilities")
    tap("返回设置"); tap("USB 输出")
    XCTAssertTrue(app.staticTexts["USB 独占"].exists)
    capture("usb-capabilities")
    tap("返回设置"); tap("返回音乐库")
  }

  func testNativeEqualizerAndPresets() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    tap("设置", timeout: 30); tap("均衡器")
    let enabled = app.switches["启用均衡器"]
    XCTAssertTrue(enabled.isEnabled)
    if enabled.value as? String == "0" { enabled.tap() }
    tap("均衡器预设：低频增强")
    capture("eq-preset")
    tap("调节 1k Hz"); tap("提高当前频段")
    XCTAssertEqual(element("当前频段增益").value as? String, "+0.5 dB")
    let name = app.textFields["自定义预设名称"]
    for _ in 0..<6 { if name.isHittable { break }; app.swipeUp() }
    let presetName = "EQ" + String(Int(Date().timeIntervalSince1970))
    name.tap(); name.typeText(presetName)
    XCTAssertEqual(name.value as? String, presetName)
    tap("保存均衡器预设")
    XCTAssertTrue(app.staticTexts["预设已保存"].waitForExistence(timeout: 5))
    app.swipeUp(); capture("eq-saved-preamp")
    tap("返回设置"); tap("返回音乐库")
    tap("按歌曲浏览"); tap("播放 初见")
    assertClockAdvanced()
    tap("下一首")
    XCTAssertTrue(app.staticTexts["微光"].firstMatch.waitForExistence(timeout: 10))
    assertClockAdvanced()
    tap("返回音乐库"); tap("设置"); tap("均衡器")
    let processed = NSPredicate { _,_ in
      self.element("均衡器运行状态").value as? String == "处理中"
    }
    XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: processed, object: app)], timeout: 15), .completed, app.debugDescription)
    capture("eq-native-processing")
    app.terminate(); app.launch()
    tap("设置", timeout: 30); tap("均衡器")
    XCTAssertEqual(app.switches["启用均衡器"].value as? String, "1")
    let savedPreset = element("均衡器预设：" + presetName)
    for _ in 0..<5 { if savedPreset.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(savedPreset.isSelected)
    for _ in 0..<5 { if app.switches["启用均衡器"].isHittable { break }; app.swipeDown() }
    app.switches["启用均衡器"].tap()
    capture("eq-disabled-preserved")
  }

  func testRecordMaterialsAndLight() {
    continueAfterFailure = false
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    tap("设置", timeout: 30); tap("样式管理")
    tap("唱头颜色：香槟金")
    tap("唱头灯光：冰蓝")
    capture("record-light-options")
    tap("返回设置"); tap("返回音乐库")
    app.terminate(); app.launch()
    tap("设置", timeout: 30); tap("样式管理")
    XCTAssertTrue(element("唱头颜色：香槟金").isSelected)
    XCTAssertTrue(element("唱头灯光：冰蓝").isSelected)
    tap("唱头灯光：暖红")
    tap("纯黑胶")
    capture("record-material-options")
    tap("返回设置"); tap("返回音乐库")
    tap("按歌曲浏览"); tap("播放 初见")
    selectPlayerStyle("唱片")
    assertClockAdvanced(3)
    assertPlayerHeaderStaysAnchored()
    capture("record-black-centered")
    tap("暂停")
    Thread.sleep(forTimeInterval: 1.1)
    capture("record-arm-parked")
    tap("打开播放外观")
    tap("烟熏透明")
    tap("冰蓝反光")
    tap("唱臂风格：经典机械")
    XCTAssertTrue(element("冰蓝反光").isSelected)
    XCTAssertTrue(element("唱臂风格：经典机械").isSelected)
    tap("唱头颜色：冰蓝")
    XCTAssertTrue(element("唱头颜色：冰蓝").isSelected)
    capture("record-appearance-sheet")
    tap("收起播放外观面板")
    tap("播放")
    assertClockAdvanced(3)
    capture("record-blue-centered")
    XCUIDevice.shared.orientation = .landscapeLeft
    Thread.sleep(forTimeInterval: 1.2)
    XCTAssertTrue(element("暂停").isHittable)
    XCTAssertTrue(element("播放队列").isHittable)
    XCTAssertTrue(element("打开播放外观").isHittable)
    assertPlayerHeaderStaysAnchored()
    capture("record-blue-landscape")
    tap("打开播放外观")
    capture("record-sheet-landscape")
    tap("收起播放外观面板")
    tap("暂停")
    XCUIDevice.shared.orientation = .portrait
    app.terminate(); app.launch()
    tap("打开播放页面", timeout: 30)
    tap("打开播放外观")
    XCTAssertTrue(element("冰蓝反光").isSelected)
    XCTAssertTrue(element("唱臂风格：经典机械").isSelected)
    XCTAssertTrue(element("唱头颜色：冰蓝").isSelected)
    tap("唱臂风格：简约唱臂")
    tap("唱头颜色：原色")
    tap("收起播放外观面板")
  }

}
