#!/usr/bin/env python3
"""Render the real One setup page as a static demo with the API shim."""
import os, jinja2

SRC = os.path.expanduser("~/downstage-os/one/templates/index.html")
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

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w").write(html)
print("wrote", OUT, len(html), "bytes")
