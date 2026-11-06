// Added only to the generated unsigned Simulator fixture. Never included by the
// signed candidate workflow or the production-wrapper compile.
#if DEBUG
import Capacitor
import WebKit
import AVFoundation
import Photos

class NativeQAViewController: CAPBridgeViewController, WKScriptMessageHandler {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Capacitor replaces configuration.userContentController while creating
        // its bridge. Install on the final controller before viewDidLoad loads JS.
        guard let controller = webView?.configuration.userContentController else { return }
        controller.add(self, name: "bkNativeQA")
        controller.addUserScript(WKUserScript(source: """
            window.addEventListener('error', function(event) {
                window.webkit.messageHandlers.bkNativeQA.postMessage({ready:false,fatalError:String(event.message).slice(0,500)});
            });
            window.addEventListener('unhandledrejection', function(event) {
                window.webkit.messageHandlers.bkNativeQA.postMessage({ready:false,fatalError:String(event.reason).slice(0,500)});
            });
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let boot: [String: Any] = [
            "controller": "NativeQAViewController", "reportHandlerInstalled": true,
            "bundleId": Bundle.main.bundleIdentifier ?? "unknown"
        ]
        writeReport(boot, filename: "native-qa-boot.json")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "bkNativeQA", var report = message.body as? [String: Any] else { return }
        report["cameraAuthorization"] = AVCaptureDevice.authorizationStatus(for: .video).rawValue
        report["photosAuthorization"] = PHPhotoLibrary.authorizationStatus(for: .readWrite).rawValue
        report["nativeProcessIdentifier"] = ProcessInfo.processInfo.processIdentifier
        writeReport(report, filename: "native-qa-report.json")
        if report["ready"] as? Bool == true, let phase = report["phase"] as? String,
           let filename = ["initial": "initial-bridge-report.json", "warm": "warm-callback-report.json", "cold": "cold-callback-report.json"][phase] {
            writeReport(report, filename: filename)
        }
    }

    private func writeReport(_ report: [String: Any], filename: String) {
        do {
            let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: directory.appendingPathComponent(filename), options: .atomic)
            NSLog("BK_NATIVE_QA wrote %@", filename)
        } catch {
            NSLog("BK_NATIVE_QA could not write %@", filename)
        }
    }
}
#endif
