import AuthenticationServices
import Capacitor
import UIKit

/// OAuth must use an authentication session, not a general Safari popover.
/// The presenting window is captured from the active Capacitor scene on iPad.
@objc(NativeAuthSessionPlugin)
public class NativeAuthSessionPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "NativeAuthSessionPlugin"
    public let jsName = "NativeAuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]
    private var session: ASWebAuthenticationSession?
    private var presentationWindow: UIWindow?

    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("Authentication is unavailable.", "AUTH_UNAVAILABLE")
                return
            }
            guard self.session == nil else {
                call.reject("A sign-in is already in progress.", "AUTH_IN_PROGRESS")
                return
            }
            guard let value = call.getString("url"), let url = URL(string: value),
                  url.scheme == "https", url.user == nil, url.password == nil,
                  url.host == "gpnboygoosrmeydwjpvk.supabase.co",
                  url.path == "/auth/v1/authorize" else {
                call.reject("Invalid authentication URL.", "AUTH_INVALID_URL")
                return
            }
            guard let window = self.bridge?.viewController?.view.window else {
                call.reject("Return to Ball Knower and try again.", "AUTH_NO_WINDOW")
                return
            }
            self.presentationWindow = window
            let authSession = ASWebAuthenticationSession(url: url, callbackURLScheme: "ballknower") { [weak self] callbackURL, error in
                DispatchQueue.main.async {
                    self?.session = nil
                    self?.presentationWindow = nil
                    if let error = error as? ASWebAuthenticationSessionError,
                       error.code == .canceledLogin {
                        call.reject("Sign-in cancelled.", "AUTH_CANCELLED")
                        return
                    }
                    guard error == nil, let callback = callbackURL,
                          callback.scheme == "ballknower", callback.host == "auth",
                          callback.path == "/callback", callback.user == nil,
                          callback.password == nil, callback.port == nil else {
                        call.reject("Sign-in could not be completed.", "AUTH_FAILED")
                        return
                    }
                    call.resolve(["url": callback.absoluteString])
                }
            }
            authSession.presentationContextProvider = self
            authSession.prefersEphemeralWebBrowserSession = false
            self.session = authSession
            if !authSession.start() {
                self.session = nil
                self.presentationWindow = nil
                call.reject("Sign-in could not open. Please try again.", "AUTH_START_FAILED")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // authenticate() refuses to start without the real, active scene window.
        return presentationWindow ?? ASPresentationAnchor()
    }
}
