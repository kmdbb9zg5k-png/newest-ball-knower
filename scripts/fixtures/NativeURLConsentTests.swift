import XCTest

@MainActor
final class NativeURLConsentTests: XCTestCase {
    func testWarmAndColdCallbacks() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.ballknower.ios.nativeqa")
        app.launch()
        expectStatus("Native QA ready", in: app)
        keepScreenshot("initial-bridge", app: app)

        // Apple's public UI-testing URL API preserves the actual native URL
        // dispatch. Consent is handled normally if this OS displays a dialog.
        app.open(URL(string: "ballknower://auth/callback#access_token=native-qa-only&refresh_token=native-qa-warm")!)
        approveKnownOpenDialog(app: app)
        expectStatus("Warm callback rejected", in: app)
        keepScreenshot("warm-callback", app: app)

        app.terminate()
        app.open(URL(string: "ballknower://auth/callback#access_token=native-qa-only&refresh_token=native-qa-cold")!)
        approveKnownOpenDialog(app: app)
        expectStatus("Cold callback rejected", in: app)
        keepScreenshot("cold-callback", app: app)
    }

    private func expectStatus(_ status: String, in app: XCUIApplication) {
        XCTAssertTrue(app.staticTexts[status].firstMatch.waitForExistence(timeout: 60), "Expected \(status).\n\(app.debugDescription)")
    }

    private func keepScreenshot(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func approveKnownOpenDialog(app: XCUIApplication) {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let deadline = Date().addingTimeInterval(2)
        while Date() < deadline {
            var applications = [springboard]
            if app.state == .runningForeground { applications.append(app) }
            for application in applications {
                let alert = application.alerts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Ball Knower")).firstMatch
                if alert.exists {
                    let open = alert.buttons["Open"]
                    XCTAssertTrue(open.exists, "Expected the known app-opening confirmation")
                    open.tap()
                    return
                }
            }
            Thread.sleep(forTimeInterval: 0.25)
        }
        // The status assertion still requires actual callback delivery when the
        // OS delivers an already-approved link without showing a confirmation.
    }
}
