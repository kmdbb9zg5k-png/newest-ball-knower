// Added only to the generated unsigned Simulator fixture. Never included by the
// signed candidate workflow or the production-wrapper compile.
#if DEBUG
import Capacitor
import WebKit
import AVFoundation
import Photos

class NativeQAViewController: CAPBridgeViewController, WKScriptMessageHandler {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.userContentController.add(self, name: "bkNativeQA")
        return configuration
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "bkNativeQA", var report = message.body as? [String: Any] else { return }
        report["cameraAuthorization"] = AVCaptureDevice.authorizationStatus(for: .video).rawValue
        report["photosAuthorization"] = PHPhotoLibrary.authorizationStatus(for: .readWrite).rawValue
        do {
            let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: directory.appendingPathComponent("native-qa-report.json"), options: .atomic)
        } catch {
            print("Ball Knower native QA report could not be written.")
        }
    }
}
#endif
