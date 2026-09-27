"""Record deterministic WebGL gameplay sessions for human review.

The normal regression suite proves state transitions. This runner keeps the same
QA clock deterministic, but advances it at video speed so every control, block,
route, skill move, defensive look, and contact sequence is visible in the
Playwright recording. It also writes a compact diagnostic timeline beside each
video so visual problems can be tied back to game state.
"""

import argparse
import html
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
VIEWPORT = {"width": 932, "height": 430}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def compact_diagnostics(page, label):
    state = page.evaluate("bk3dDiagnostics()")
    carrier = next((player for player in state["players"] if player["hasBall"]), None)
    return {
        "label": label,
        "simTime": round(state["simTime"], 3),
        "phase": state["phase"],
        "mode": state["mode"],
        "play": state["selected"],
        "defense": state["defense"],
        "down": state["drive"]["down"],
        "ball": state["drive"]["ball"],
        "lastSkill": state["lastSkill"],
        "lastTackler": state["lastTackler"],
        "contact": state["contact"],
        "pocketPressure": round(state["pocketPressure"], 3),
        "stamina": round(state["stamina"], 3),
        "carrier": None if not carrier else {
            "role": carrier["role"],
            "x": round(carrier["x"], 2),
            "z": round(carrier["z"], 2),
            "action": carrier["action"],
        },
        "engagedDefenders": sum(1 for player in state["players"] if player["team"] == 1 and player["engaged"]),
        "animationStates": sorted(set(state["athletes"]["states"])),
        "drawCalls": state["drawCalls"],
        "glError": state["glError"],
    }


def animate(page, seconds, timeline, label, fps=8):
    frames = max(1, round(seconds * fps))
    for frame in range(frames):
        page.evaluate("dt => bk3dTest.step(dt)", 1 / fps)
        page.wait_for_timeout(round(1000 / fps))
        if frame == frames - 1 or frame % max(1, fps // 4) == 0:
            timeline.append(compact_diagnostics(page, label))


def touch_point(box, x_ratio=.5, y_ratio=.5, touch_id=1):
    return {
        "x": box["x"] + box["width"] * x_ratio,
        "y": box["y"] + box["height"] * y_ratio,
        "id": touch_id,
    }


def send_touches(cdp, points):
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": points})


def release_touches(cdp):
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


def swipe(page, selector, dx, dy, touch_id):
    box = page.locator(selector).bounding_box()
    assert box, f"Missing visible control: {selector}"
    start = touch_point(box, touch_id=touch_id)
    cdp = page.context.new_cdp_session(page)
    send_touches(cdp, [start])
    cdp.send("Input.dispatchTouchEvent", {
        "type": "touchMove",
        "touchPoints": [{"x": start["x"] + dx, "y": start["y"] + dy, "id": touch_id}],
    })
    release_touches(cdp)


def restart(page, timeline):
    if not page.evaluate("bk3dDiagnostics().paused"):
        page.click("#pause")
    page.locator("#paused").wait_for(state="visible")
    page.click("#restart")
    animate(page, .2, timeline, "restart")


def choose_play(page, mode, play_index, snap_number):
    page.click("#runTab" if mode == "run" else "#passTab")
    assert page.evaluate("n => bk3dTest.setSnapNumber(n)", snap_number)
    page.locator("#plays button").nth(play_index).click()


def run_playbook(page, timeline, screenshots):
    skills = [
        ("juke", None),
        ("spin-right", (44, 0)),
        ("truck", (0, -44)),
        ("hurdle", (0, 44)),
    ]
    defensive_calls = []
    for index, (expected_skill, gesture) in enumerate(skills):
        if index:
            restart(page, timeline)
        choose_play(page, "run", index, index)
        defensive_calls.append(compact_diagnostics(page, f"run-{index}-presnap")["defense"])
        stick_before = page.locator("#stick").bounding_box()
        assert stick_before and page.locator("#stick").is_visible()

        cdp = page.context.new_cdp_session(page)
        stick = touch_point(stick_before, .5, .18, 10 + index)
        send_touches(cdp, [stick])
        page.click("#snap")
        animate(page, .45, timeline, f"run-{index}-handoff")
        release_touches(cdp)

        if index == 0 and page.evaluate("bk3dDiagnostics().phase") == "run":
            stick_box = page.locator("#stick").bounding_box()
            sprint_box = page.locator("#sprint").bounding_box()
            assert stick_box and sprint_box
            assert abs(stick_box["x"] - stick_before["x"]) < 1
            assert abs(stick_box["y"] - stick_before["y"]) < 1
            cdp = page.context.new_cdp_session(page)
            send_touches(cdp, [
                touch_point(stick_box, .5, .18, 30),
                touch_point(sprint_box, .5, .5, 31),
            ])
            animate(page, .3, timeline, "run-0-stick-plus-sprint")
            release_touches(cdp)

        if page.evaluate("bk3dDiagnostics().phase") == "run":
            if gesture is None:
                page.click("#juke")
            else:
                swipe(page, "#juke", *gesture, 50 + index)
            animate(page, .22, timeline, f"run-{index}-{expected_skill}")
            actual_skill = page.evaluate("bk3dDiagnostics().lastSkill")
            assert actual_skill == expected_skill, (expected_skill, actual_skill)

        if page.evaluate("bk3dDiagnostics().phase") == "run":
            assert page.evaluate("bk3dTest.forceContact('wrap')")
        animate(page, .85, timeline, f"run-{index}-finish")
        page.screenshot(path=str(screenshots / f"run-{index + 1}.png"))

    assert len({call["id"] for call in defensive_calls}) == 4, defensive_calls
    return {
        "plays": 4,
        "controls": ["pre-snap joystick", "sprint", "juke", "spin", "truck", "hurdle"],
        "defensiveCalls": defensive_calls,
    }


def passing_and_scramble(page, timeline, screenshots):
    catch_styles = ["secure", "aggressive", "rac", "secure"]
    completed = []
    for index, catch_style in enumerate(catch_styles):
        if index:
            restart(page, timeline)
        choose_play(page, "pass", index, index)
        page.click("#snap")
        animate(page, 1.05, timeline, f"pass-{index}-routes")
        targets = page.locator(".target:visible")
        assert targets.count() >= 3
        targets.nth(index % targets.count()).click()
        page.locator("#catchChoices").wait_for(state="visible")
        page.locator(f'#catchChoices button[data-catch="{catch_style}"]').click()
        animate(page, 1.25, timeline, f"pass-{index}-{catch_style}")
        completed.append({"concept": index, "catchStyle": catch_style})
        page.screenshot(path=str(screenshots / f"pass-{index + 1}.png"))

    restart(page, timeline)
    choose_play(page, "pass", 0, 4)
    page.click("#snap")
    animate(page, .2, timeline, "scramble-drop")
    stick_box = page.locator("#stick").bounding_box()
    assert stick_box
    cdp = page.context.new_cdp_session(page)
    send_touches(cdp, [touch_point(stick_box, .5, .08, 81)])
    animate(page, 1.45, timeline, "scramble-forward")
    release_touches(cdp)
    scrambled = page.evaluate("bk3dDiagnostics()")
    assert scrambled["phase"] == "run" and scrambled["players"][5]["hasBall"], scrambled["phase"]
    swipe(page, "#juke", 0, 44, 82)
    animate(page, .5, timeline, "qb-slide")
    assert page.evaluate("bk3dDiagnostics().lastSkill") == "slide"
    page.screenshot(path=str(screenshots / "qb-slide.png"))

    restart(page, timeline)
    choose_play(page, "pass", 3, 5)
    page.click("#snap")
    animate(page, .2, timeline, "rollout-drop")
    stick_box = page.locator("#stick").bounding_box()
    cdp = page.context.new_cdp_session(page)
    send_touches(cdp, [touch_point(stick_box, .95, .5, 83)])
    animate(page, 1.55, timeline, "rollout-right")
    release_touches(cdp)
    assert page.locator("#throwAway").get_attribute("data-ready") == "true"
    page.click("#throwAway")
    animate(page, .7, timeline, "throwaway")
    page.screenshot(path=str(screenshots / "throwaway.png"))
    return {
        "plays": 6,
        "controls": ["four pass concepts", "three catch styles", "QB scramble", "QB slide", "rollout", "throwaway"],
        "passes": completed,
    }


def defense_and_contact(page, timeline, screenshots):
    contacts = ["wrap", "dive", "gang", "big-hit"]
    calls = []
    for snap_number in range(6):
        if snap_number:
            restart(page, timeline)
        choose_play(page, "run", snap_number % 4, snap_number)
        presnap = compact_diagnostics(page, f"defense-{snap_number}-presnap")
        calls.append(presnap["defense"])
        timeline.append(presnap)
        page.screenshot(path=str(screenshots / f"defense-{snap_number + 1}-presnap.png"))
        page.click("#snap")
        animate(page, .38, timeline, f"defense-{snap_number}-fit")
        if page.evaluate("bk3dDiagnostics().phase") == "run":
            contact = contacts[snap_number % len(contacts)]
            assert page.evaluate("kind => bk3dTest.forceContact(kind)", contact)
            animate(page, .9, timeline, f"contact-{contact}")
    assert len({call["id"] for call in calls}) == 6, calls
    assert len({call["coverage"] for call in calls}) == 4, calls
    return {
        "plays": 6,
        "controls": ["six defensive schemes", "run fits", "wrap", "dive", "gang tackle", "big hit"],
        "defensiveCalls": calls,
    }


def record_scenario(browser, origin, output, name, runner):
    raw_video = output / "raw-video"
    raw_video.mkdir(parents=True, exist_ok=True)
    screenshots = output / "screenshots" / name
    screenshots.mkdir(parents=True, exist_ok=True)
    context = browser.new_context(
        viewport=VIEWPORT,
        device_scale_factor=2,
        has_touch=True,
        record_video_dir=str(raw_video),
        record_video_size=VIEWPORT,
    )
    page = context.new_page()
    page_errors, console_errors, failed_requests = [], [], []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("requestfailed", lambda request: failed_requests.append({"url": request.url, "error": request.failure}))
    timeline = []
    video = page.video
    started = time.time()
    error = None
    details = {}
    try:
        page.goto(origin + "/play-moment-3d-preview.html?qa&scenario=redzone", wait_until="domcontentloaded")
        page.wait_for_function("window.bk3dDiagnostics && bk3dDiagnostics().athletes.ready", timeout=30_000)
        page.evaluate("bk3dTest.manualFrames(); bk3dTest.step(.2)")
        timeline.append(compact_diagnostics(page, "loaded"))
        page.screenshot(path=str(screenshots / "loaded.png"))
        details = runner(page, timeline, screenshots)
        final = compact_diagnostics(page, "final")
        timeline.append(final)
        assert final["glError"] == 0, final
        assert not page_errors and not console_errors and not failed_requests, {
            "pageErrors": page_errors,
            "consoleErrors": console_errors,
            "failedRequests": failed_requests,
        }
    except Exception as exc:  # Keep video and diagnostics when a scenario fails.
        error = f"{type(exc).__name__}: {exc}"
    finally:
        page.close()
        destination = output / f"{name}.webm"
        video.save_as(str(destination))
        context.close()

    scenario = {
        "name": name,
        "status": "passed" if error is None else "failed",
        "durationSeconds": round(time.time() - started, 2),
        "video": destination.name,
        "timeline": f"{name}-timeline.json",
        "details": details,
        "errors": {
            "scenario": error,
            "page": page_errors,
            "console": console_errors,
            "requests": failed_requests,
        },
    }
    (output / scenario["timeline"]).write_text(json.dumps(timeline, indent=2))
    return scenario


def write_index(output, report):
    cards = []
    for scenario in report["scenarios"]:
        controls = ", ".join(scenario.get("details", {}).get("controls", []))
        cards.append(f"""
        <section>
          <h2>{html.escape(scenario['name'].replace('-', ' ').title())}</h2>
          <p><strong>{html.escape(scenario['status'].upper())}</strong> · {scenario['durationSeconds']}s</p>
          <video controls playsinline preload="metadata" src="{html.escape(scenario['video'])}"></video>
          <p>{html.escape(controls)}</p>
          <p><a href="{html.escape(scenario['timeline'])}">Diagnostic timeline</a></p>
        </section>""")
    document = f"""<!doctype html><meta charset="utf-8"><title>Ball Knower WebGL Gameplay Review</title>
    <style>body{{font:16px system-ui;background:#07131e;color:#f5f6f8;max-width:1000px;margin:auto;padding:28px}}
    section{{background:#111f2d;border:1px solid #bfa25155;border-radius:16px;padding:20px;margin:20px 0}}
    video{{display:block;width:100%;background:#000;border-radius:10px}}a{{color:#f0ce6a}}</style>
    <h1>Ball Knower WebGL Gameplay Review</h1>
    <p>Chromium WebGL2 with SwiftShader at 932×430. Videos are visual QA evidence, not real-iPhone performance certification.</p>
    {''.join(cards)}"""
    (output / "index.html").write_text(document)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/gameplay-recordings")
    parser.add_argument("--legacy", action="store_true", help="Run the historical 8 fps playbook recorder")
    args = parser.parse_args()
    if not args.legacy:
        subprocess.run([sys.executable, str(ROOT / "scripts/record-play-moment-motion.py"), "--output", str(args.output)], check=True)
        return
    args.output.mkdir(parents=True, exist_ok=True)

    handler = lambda *a, **kw: QuietHandler(*a, directory=str(ROOT / "public"), **kw)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    report = {
        "renderer": "Chromium WebGL2 / SwiftShader",
        "viewport": VIEWPORT,
        "phonePerformanceCertified": False,
        "scenarios": [],
    }

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=os.environ.get("CHROMIUM_PATH"),
                args=[
                    "--no-sandbox",
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-unsafe-swiftshader",
                    "--ozone-platform=headless",
                ],
                env={**os.environ, "DISPLAY": ""},
            )
            for name, runner in [
                ("run-playbook-controls", run_playbook),
                ("passing-scramble-controls", passing_and_scramble),
                ("defense-contact-rotation", defense_and_contact),
            ]:
                scenario = record_scenario(browser, origin, args.output, name, runner)
                report["scenarios"].append(scenario)
                print(f"{scenario['status'].upper()}: {name}", flush=True)
            browser.close()
    finally:
        server.shutdown()
        thread.join(timeout=2)
        shutil.rmtree(args.output / "raw-video", ignore_errors=True)

    (args.output / "report.json").write_text(json.dumps(report, indent=2))
    write_index(args.output, report)
    failed = [scenario for scenario in report["scenarios"] if scenario["status"] != "passed"]
    if failed:
        raise SystemExit("Gameplay recording failures: " + ", ".join(item["name"] for item in failed))


if __name__ == "__main__":
    main()
