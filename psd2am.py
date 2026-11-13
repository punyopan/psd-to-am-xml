"""PSD -> Alight Motion XML (v0: text layers + rect placeholders for pixel layers).
Usage: python psd2am.py input.psd output.xml [--duration-ms 5000] [--fps 30]"""
import argparse, html, os
from psd_tools import PSDImage

def color(rgba):  # (r,g,b[,a]) 0-255 -> #aarrggbb
    r, g, b = rgba[:3]; a = rgba[3] if len(rgba) > 3 else 255
    return f"#{a:02x}{r:02x}{g:02x}{b:02x}"

def text_props(layer):
    try:
        st = layer.engine_dict["StyleRun"]["RunArray"][0]["StyleSheet"]["StyleSheetData"]
        size = float(st.get("FontSize", 24))
        fc = st.get("FillColor", {}).get("Values", [1, 0, 0, 0])  # ARGB 0-1
        col = color([int(fc[1]*255), int(fc[2]*255), int(fc[3]*255), int(fc[0]*255)])
        return size, col
    except Exception:
        return 24.0, "#ff000000"

def walk(group, out):
    for l in group:
        if l.is_group():
            walk(l, out); continue
        if not l.is_visible() or l.width == 0: continue
        out.append(l)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("psd"); ap.add_argument("out")
    ap.add_argument("--duration-ms", type=int, default=5000); ap.add_argument("--fps", type=int, default=30)
    a = ap.parse_args()
    psd = PSDImage.open(a.psd); W, H, T = psd.width, psd.height, a.duration_ms
    layers = []; walk(psd, layers)
    x = [f"<?xml version='1.0' encoding='UTF-8' ?>",
         f'<scene title="{html.escape(a.psd)}" width="{W}" height="{H}" exportWidth="{W}" exportHeight="{H}" '
         f'precompose="dynamicResolution" bgcolor="#ff000000" totalTime="{T}" fps="{a.fps}" modifiedTime="0" '
         f'amver="1028417" ffver="106" am="com.alightcreative.motion/5.0.273.1028417" amplatform="android" retime="freeze" retimeAdaptFPS="false">']
    lid = 1000
    for l in layers:  # PSD order is bottom->top, same as AM XML
        lid += 1
        cx, cy = l.left + l.width / 2, l.top + l.height / 2
        op = f'\n      <opacity value="{l.opacity/255:.6f}" />' if l.opacity < 255 else ""
        tr = f'<transform>\n      <location value="{cx:.6f},{cy:.6f},0.000000" />{op}\n    </transform>'
        name = html.escape(l.name)
        if l.kind == "type":
            size, col = text_props(l)
            x.append(f'  <text id="{lid}" label="{name}" startTime="0" endTime="{T}" fillType="color" mediaFillMode="fill" '
                     f'size="{size:.6f}" font="googlefonts?name=Roboto&amp;weight=400" wrapWidth="{max(l.width,64)}" align="left">\n'
                     f'    {tr}\n    <fillColor value="{col}" />\n    <content>{html.escape(l.text)}</content>\n  </text>')
        else:
            x.append(f'  <shape id="{lid}" label="{name}" startTime="0" endTime="{T}" fillType="color" mediaFillMode="fill" s=".rect">\n'
                     f'    {tr}\n    <fillColor value="#80ff00ff" />\n'
                     f'    <property name="size" type="vec2" value="{l.width:.6f},{l.height:.6f}" />\n  </shape>')
            safe = "".join(c if c.isalnum() or c in "-_ " else "_" for c in l.name)
            l.composite().save(os.path.join(os.path.dirname(os.path.abspath(a.out)), f"{lid}_{safe}.png"))
    x.append("</scene>")
    open(a.out, "w", encoding="utf-8").write("\n".join(x))
    print(f"{len(layers)} layers -> {a.out}")

if __name__ == "__main__": main()
