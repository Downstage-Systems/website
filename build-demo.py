#!/usr/bin/env python3
"""Render the real One setup page as a static demo with the API shim."""
import os, jinja2

SRC = os.path.expanduser("~/Documents/Downstage Systems/downstage-os/one/templates/index.html")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo", "index.html")

config = {
    "mode": "local", "ip": "", "hdmi1_source": "cleantimer", "hdmi2_source": "pattern-card",
    "hdmi1_res": "1920x1080", "hdmi2_res": "1920x1080",
    "hdmi1_rotate": "normal", "hdmi2_rotate": "normal",
    "hdmi1_external_url": "", "hdmi2_external_url": "",
    "companion_channel": "stable", "watchdog": True, "serial": "DS1-A-2607-0001",
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
html = tpl.render(config=Cfg(config), local_ip="192.168.1.20", hostname="downstage-0001",
                  net_iface="eth0", ip_history=[],
                  ontime_installed=True, ontime_running=True,
                  companion_installed=True, companion_running=True)

# shim must patch fetch before the page's own scripts run
html = html.replace("<body>", '<body>\n<script src="demo-shim.js"></script>', 1)
html = html.replace("<title>", "<title>Demo — ", 1) if "<title>" in html else html
# the unit's favicon lives on the unit — point the demo at the site's
import re as _re
html = _re.sub(r'<link rel="apple-touch-icon"[^>]*>',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">', html, count=1)
html = _re.sub(r'<link rel="icon"[^>]*>',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'
    '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">'
    '<link rel="icon" href="/favicon.ico" sizes="48x48 32x32 16x16">', html, count=1)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w").write(html)
print("wrote", OUT, len(html), "bytes")

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
                      hostname="downstage-v001", ip_history=[])
html_v = html_v.replace("<body>", '<body>\n<script src="demo-shim.js"></script>', 1)
html_v = html_v.replace("<title>", "<title>Demo — ", 1) if "<title>" in html_v else html_v
html_v = _re.sub(r'<link rel="apple-touch-icon"[^>]*>',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">', html_v, count=1)
html_v = _re.sub(r'<link rel="icon"[^>]*>',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'
    '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">'
    '<link rel="icon" href="/favicon.ico" sizes="48x48 32x32 16x16">', html_v, count=1)
os.makedirs(os.path.dirname(OUT_VIEW), exist_ok=True)
open(OUT_VIEW, "w").write(html_v)
print("wrote", OUT_VIEW, len(html_v), "bytes")
