#!/usr/bin/env python3
"""Render the real One setup page as a static demo with the API shim."""
import os, time, jinja2
BUILD_TS = str(int(time.time()))

SRC = os.path.expanduser("~/Documents/Downstage Systems/downstage-os/one/templates/index.html")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo", "index.html")

config = {
    "mode": "local", "ip": "", "hdmi1_source": "cleantimer", "hdmi2_source": "pattern-card",
    "hdmi1_res": "1920x1080", "hdmi2_res": "1920x1080",
    "hdmi1_rotate": "normal", "hdmi2_rotate": "normal",
    "hdmi1_external_url": "", "hdmi2_external_url": "",
    "companion_channel": "stable", "watchdog": True, "serial": "DS1-A-2607-0000",
    "hdmi1_ct_freeze": True, "hdmi1_ct_hideprogress": True, "hdmi1_ct_hideclock": True,
    "hdmi1_ct_hidecards": True, "hdmi1_ct_keycolour": "000000", "hdmi1_ct_timercolour": "ffffff",
    "hdmi2_ct_freeze": True, "hdmi2_ct_hideprogress": True, "hdmi2_ct_hideclock": True,
    "hdmi2_ct_hidecards": True, "hdmi2_ct_keycolour": "000000", "hdmi2_ct_timercolour": "ffffff",
}

class Cfg(dict):
    __getattr__ = lambda self, k: self.get(k)

env = jinja2.Environment(undefined=jinja2.ChainableUndefined)
env.filters["tojson"] = lambda v: __import__("json").dumps(v)
tpl = env.from_string(open(SRC).read())
html = tpl.render(config=Cfg(config), local_ip="192.168.1.20", hostname="downstage-0000",
                  net_iface="eth0", ip_history=[],
                  ontime_installed=True, ontime_running=True,
                  companion_installed=True, companion_running=True)

# shim must patch fetch before the page's own scripts run
html = html.replace("<body>", '<body>\n<script src="demo-shim.js?v=' + BUILD_TS + '"></script>', 1)
# demo: the fake hostname is noise — hide the header address box
html = html.replace("<body>", '<body>\n<style>.addr-box{display:none!important}</style>', 1)
html = html.replace("<title>", "<title>Demo — ", 1) if "<title>" in html else html
# the unit's favicon lives on the unit — point the demo at the site's
import re as _re
# demo preview tiles are static images — the right-click quick actions don't exist here
html = _re.sub(r'<div class="preview-hint">.*?</div>\n?', '', html, count=1)
html = _re.sub(r'<link rel="apple-touch-icon"[^>]*>',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">', html, count=1)
html = _re.sub(r'<link rel="icon"[^>]*>',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'
    '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">'
    '<link rel="icon" href="/favicon.ico" sizes="48x48 32x32 16x16">', html, count=1)

def scrub(text):
    """These pages are public: our working notes stay out of the source. HTML
    comments, comments in <style> blocks, and // comments in scripts."""
    text = _re.sub(r'<!--.*?-->', '', text, flags=_re.S)
    text = _re.sub(r'<style\b.*?</style>', lambda m: _re.sub(r'/\*.*?\*/', '', m.group(0), flags=_re.S), text, flags=_re.S)
    def js(m):
        out = []
        for line in m.group(0).split('\n'):
            if _re.match(r'\s*//', line): continue
            out.append(_re.sub(r'\s{2,}// .*$', '', line))
        return '\n'.join(out)
    return _re.sub(r'<script\b[^>]*>.*?</script>', js, text, flags=_re.S)

def must(text, old, new):
    """A template change that breaks a demo rewrite fails the build, loudly."""
    assert text.count(old) == 1, ("demo rewrite no longer matches", old, text.count(old))
    return text.replace(old, new)

# the Touch / Browser toggle: pages next to each other here, not the unit's routes
html = must(html, "location.replace('/touch')", "location.replace('touch.html')")
html = must(html, "location.href='/touch'", "location.href='touch.html'")

html = scrub(html)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w").write(html)
print("wrote", OUT, len(html), "bytes")

# ── the touch page ────────────────────────────────────────────────────────────
SRC_TOUCH = os.path.expanduser("~/Documents/Downstage Systems/downstage-os/one/templates/touch.html")
OUT_TOUCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo", "touch.html")
t = env.from_string(open(SRC_TOUCH).read()).render(hostname="downstage-0000")
t = must(t, "<body>", '<body>\n<script src="demo-shim.js?v=' + BUILD_TS + '"></script>')
t = must(t, "<title>", "<title>Demo — ")
t = must(t, '<link rel="manifest" href="/touch.webmanifest">', '')
t = must(t, '<link rel="apple-touch-icon" href="/static/apple-touch-icon.png">',
         '<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="icon" type="image/svg+xml" href="/favicon.svg">')
t = must(t, "location.href = '/?browser=1'", "location.href = 'index.html?browser=1'")
# the Deck: the canned mockup (the + XL gets a stand-in socket in the shim)
t = must(t, "return S.status ? 'http://' + host + ':8000/emulator/' + (s.companion_emulator_id || '') : '';",
         "return S.status ? 'deck.html' : '';")
# the full timer: the fake screens, which follow the simulated show
t = must(t, "return v === 'custom' ? '/view/custom-timer' : v === 'aux1' ? '/view/aux?n=1' : 'http://' + HOST + ':4001' + v;",
         "return v === 'custom' ? window.__demoCustom() : v === 'aux1' ? 'screen.html?src=aux1' : 'screen.html?src=' + encodeURIComponent(v);")
# output previews: never an MJPEG grab, the fake screen for what the output shows
t = must(t, "const key = mode + '|' + (mode === 'virtual' ? src : '');",
         "const key = mode + '|' + src + '|' + bo.join() + '|' + (s.testcard_outputs || []).join();")
t = must(t, "if (mode === 'live') {\n        box.innerHTML = '<img alt=\"\">';", "if (false) {\n        box.innerHTML = '<img alt=\"\">';")
t = scrub(t)
open(OUT_TOUCH, "w").write(t)
print("wrote", OUT_TOUCH, len(t), "bytes")

# the unit's files these pages name, where the site serves them
import shutil
ST = os.path.expanduser("~/Documents/Downstage Systems/downstage-os/one/static")
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
for f in ("keepawake.mp4", "downstage-one-mark.svg", "fonts/inter-400.woff2", "fonts/inter-600.woff2",
          "fonts/rajdhani-600.woff2", "fonts/rajdhani-700.woff2", "fonts/share-tech-mono-400.woff2"):
    shutil.copy2(os.path.join(ST, f), os.path.join(SITE, f))

# ── Downstage View demo ───────────────────────────────────────────────────────
SRC_VIEW = os.path.expanduser("~/Documents/Downstage Systems/downstage-os/view/templates/index.html")
OUT_VIEW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo", "view", "index.html")

view_config = {
    "ip": "192.168.1.20", "source": "cleantimer", "external_url": "",
    "cleantimer_freeze": True, "cleantimer_hideprogress": True,
    "cleantimer_hideclock": True, "cleantimer_hidecards": True,
    "cleantimer_keycolour": "000000", "cleantimer_timercolour": "ffffff",
}

class VCfg(dict):
    __getattr__ = lambda self, k: self.get(k)

tpl_v = env.from_string(open(SRC_VIEW).read())
html_v = tpl_v.render(config=VCfg(view_config), local_ip="192.168.1.31",
                      hostname="downstage-v000", ip_history=[])
html_v = html_v.replace("<body>", '<body>\n<script src="demo-shim.js?v=' + BUILD_TS + '"></script>', 1)
html_v = html_v.replace("<body>", '<body>\n<style>.addr-box{display:none!important}</style>', 1)
html_v = html_v.replace("<title>", "<title>Demo — ", 1) if "<title>" in html_v else html_v
html_v = _re.sub(r'<link rel="apple-touch-icon"[^>]*>',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">', html_v, count=1)
html_v = _re.sub(r'<link rel="icon"[^>]*>',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'
    '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">'
    '<link rel="icon" href="/favicon.ico" sizes="48x48 32x32 16x16">', html_v, count=1)
os.makedirs(os.path.dirname(OUT_VIEW), exist_ok=True)
html_v = scrub(html_v)
open(OUT_VIEW, "w").write(html_v)
print("wrote", OUT_VIEW, len(html_v), "bytes")
