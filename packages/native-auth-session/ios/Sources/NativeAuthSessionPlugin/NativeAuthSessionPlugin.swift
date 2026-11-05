import AuthenticationServices
import Capacitor
import UIKit

/// OAuth must use an authentication session, not a general Safari popover.
/// The presenting window is captured from the active Capacitor scene on iPad.
@objc(NativeAuthSessionPlugin)
public class NativeAuthSessionPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "NativeAuthSessionPlugin"
    public let jsName = "NativeAuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorizeAppleForDeletion", returnType: CAPPluginReturnPromise)
    ]
    private var session: ASWebAuthenticationSession?
    private var presentationWindow: UIWindow?
    private var deletionCall: CAPPluginCall?
    private var deletionState: String?
    private var deletionController: ASAuthorizationController?

    @objc func authenticate(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("Authentication is unavailable.", "AUTH_UNAVAILABLE")
                return
            }
            guard self.session == nil, self.deletionCall == nil else {
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

    @objc func authorizeAppleForDeletion(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("Authentication is unavailable.", "AUTH_UNAVAILABLE")
                return
            }
            guard self.session == nil, self.deletionCall == nil else {
                call.reject("A sign-in is already in progress.", "AUTH_IN_PROGRESS")
                return
            }
            guard let window = self.bridge?.viewController?.view.window,
                  let nonce = call.getString("nonce"), nonce.count == 64,
                  nonce.allSatisfy({ "0123456789abcdef".contains($0) }) else {
                call.reject("Return to Ball Knower and try again.", "AUTH_NO_WINDOW")
                return
            }
            let state = UUID().uuidString
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.nonce = nonce
            request.state = state
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.presentationWindow = window
            self.deletionCall = call
            self.deletionState = state
            self.deletionController = controller
            controller.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = deletionCall else { return }
        defer { clearDeletionAuthorization() }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              credential.state == deletionState,
              let codeData = credential.authorizationCode,
              let code = String(data: codeData, encoding: .utf8), !code.isEmpty else {
            call.reject("Apple authorization could not be verified.", "AUTH_FAILED")
            return
        }
        call.resolve(["authorizationCode": code, "user": credential.user])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = deletionCall else { return }
        defer { clearDeletionAuthorization() }
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            call.reject("Sign-in cancelled.", "AUTH_CANCELLED")
        } else {
            call.reject("Apple authorization could not be completed.", "AUTH_FAILED")
        }
    }

    private func clearDeletionAuthorization() {
        deletionCall = nil
        deletionState = nil
        deletionController = nil
        presentationWindow = nil
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return presentationWindow ?? ASPresentationAnchor()
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // authenticate() refuses to start without the real, active scene window.
        return presentationWindow ?? ASPresentationAnchor()
    }
}
