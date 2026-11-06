# Native GM alert feedback — November 5, 2026

GM alerts previously requested only `navigator.vibrate`. The existing private
Capacitor plugin now exposes `notifyGmEvent()`, which requests UIKit warning
notification feedback on the main thread while the app is active. Both native
authentication methods and their state remain unchanged. No new package,
permission, paid asset or provider configuration is added.

The shared alert helper starts the iOS request without awaiting it. Browser and
Android retain the existing optional `[80, 60, 120]` browser vibration request.
Missing native methods in older binaries, synchronous bridge failures, rejected
native calls and unsupported/throwing browser vibration cannot interrupt alert
presentation or a decision. Existing event deduplication also prevents another
pulse when reopening a reviewed alert or replaying an initial StrictMode effect.

Checks run:

- `node scripts/gm-event-haptics-check.mjs`: actual helper and alert component
  with controlled React/device boundaries; native routing, fallback/failure
  cases, an unresponsive bridge, deduplication and decision/review/close behavior.
  It also checks native method registration, the main-thread/active-app contract,
  and preservation of both authentication methods.
- Existing native authentication/session and iOS release source gates pass.

The JavaScript fixtures and Swift source contracts do not establish physical
feedback. The native package workflow separately compiles the actual plugin for
an iOS Simulator target without signing. Its package declares both Capacitor
and Cordova framework products, as required by the SDK's imported headers.
Build the updated app in Xcode/Codemagic and
install that exact signed build on a real iPhone. Verify one warning pulse for a
new GM alert, no additional pulse on review, another pulse for the next new
event, and usable decisions/closing when device feedback is unavailable. Verify
background/inactive delivery stays silent. System settings and device hardware
determine whether UIKit actually produces a pulse.

A web deployment cannot add this method to an already installed binary; older
binaries remain safe through the optional fallback. An unsigned package compile
does not establish a TestFlight install or physical-device vibration.

Primary API: [Apple UINotificationFeedbackGenerator](https://developer.apple.com/documentation/uikit/uinotificationfeedbackgenerator).
