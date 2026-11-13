"""PSD -> Alight Motion XML (text layers + image layers).
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
    ap.add_argument("--folder", default=None, help="phone folder the PNGs will be in (default: Download/<psd name>)")
    ap.add_argument("--no-trim", dest="trim", action="store_false", help="keep transparent edges")
    a = ap.parse_args()
    base = "".join(c if (c.isascii() and c.isalnum()) or c in "-_" else "_" for c in os.path.splitext(os.path.basename(a.psd))[0]) or "psd"
    a.folder = a.folder or f"/storage/emulated/0/Download/{base}"
    psd = PSDImage.open(a.psd); W, H, T = psd.width, psd.height, a.duration_ms
    layers = []; walk(psd, layers)
    x = [f"<?xml version='1.0' encoding='UTF-8' ?>",
         f'<scene title="{html.escape(os.path.splitext(os.path.basename(a.psd))[0])}" width="{W}" height="{H}" exportWidth="{W}" exportHeight="{H}" '
         f'precompose="dynamicResolution" bgcolor="#ff000000" totalTime="{T}" fps="{a.fps}" modifiedTime="0" '
         f'amver="1028417" ffver="106" am="com.alightcreative.motion/5.0.273.1028417" amplatform="android" retime="freeze" retimeAdaptFPS="false">']
    lid = 1000; media = []
    for l in layers:  # PSD order is bottom->top, same as AM XML
        lid += 1
        img, left, top, lw, lh = None, l.left, l.top, l.width, l.height
        if l.kind != "type":
            img = l.topil()  # raw pixels: no clipping, no opacity (opacity goes in the XML)
            if img is not None and img.mode != "RGBA": img = img.convert("RGBA")
            if img is None:
                print(f"skip {l.name}: empty"); lid -= 1; continue
            if a.trim:
                bbox = img.getchannel("A").getbbox()
                if bbox is None or img is None:
                    print(f"skip {l.name}: empty"); lid -= 1; continue
                img = img.crop(bbox); left += bbox[0]; top += bbox[1]; lw, lh = img.size
        cx, cy = left + lw / 2, top + lh / 2
        op = f'\n      <opacity value="{l.opacity/255:.6f}" />' if l.opacity < 255 else ""
        tr = f'<transform>\n      <location value="{cx:.6f},{cy:.6f},0.000000" />{op}\n    </transform>'
        name = html.escape(l.name)
        if l.kind == "type":
            size, col = text_props(l)
            x.append(f'  <text id="{lid}" label="{name}" startTime="0" endTime="{T}" fillType="color" mediaFillMode="fill" '
                     f'size="{size:.6f}" font="googlefonts?name=Roboto&amp;weight=400" wrapWidth="{max(l.width,64)}" align="left">\n'
                     f'    {tr}\n    <fillColor value="{col}" />\n    <content>{html.escape(l.text)}</content>\n  </text>')
        else:
            safe = "".join(c if (c.isascii() and c.isalnum()) or c in "-_" else "_" for c in l.name)
            fn = f"{lid}_{safe}.png"; uri = f"file://{a.folder.rstrip('/')}/{fn}"
            media.append(f'  <media uri="{uri}" filename="{fn}" title="{fn}" type="image/png" orientation="0" width="{lw}" height="{lh}" />')
            x.append(f'  <shape id="{lid}" label="{name}" startTime="0" endTime="{T}" fillType="media" fillImage="{uri}" mediaFillMode="fill" s=".rect">\n'
                     f'    {tr}\n    <property name="size" type="vec2" value="{lw:.6f},{lh:.6f}" />\n  </shape>')
            img.save(os.path.join(os.path.dirname(os.path.abspath(a.out)), fn))
    x[2:2] = media
    x.append("</scene>")
    open(a.out, "w", encoding="utf-8").write("\n".join(x))
    print(f"{lid - 1000} layers -> {a.out}")

if __name__ == "__main__": main()
