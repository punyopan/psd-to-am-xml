# psd-to-am-xml

Convert a Photoshop `.psd` into an Alight Motion project `.xml`.

## Status
- **Image layers** → Alight Motion image layers (position, size, opacity), each exported as a PNG
- **Text layers** → Alight Motion text layers (position, size, color, content; font defaults to Roboto)
- Transparent edges cropped off each layer, with positions adjusted (`--no-trim` to disable)
- Hidden layers kept and marked hidden (`hidden="true"`), including layers inside hidden folders; empty layers skipped
- Layer folders: contents are brought out in order; a folder's opacity is multiplied into the layers inside (folders themselves are not recreated yet)
- Clipping masks and blend modes (Multiply, Screen, Overlay, Darken, Lighten, Subtract, Color Dodge/Burn, Hard/Soft Light, Difference, Exclusion); modes Alight Motion lacks fall back to Normal
- Not handled yet: layer effects
- The XML points at PNGs in `/storage/emulated/0/Download/<name>/` with `file://` paths (confirmed working in Alight Motion 5.0.273 on Android). Save `<name>.zip` to Download and extract it there into a folder with the same name, then import the XML. Use `--folder` in the Python script for a different folder.

## Keyflow
Choose **Keyflow** on the page to get a `.kf` project: one file with the images inside, opened with Keyflow's import (no extracting).
Layers keep position, opacity, blend mode and hidden state; transparent edges are cropped; clipping is applied to the pixels.
PSD folders become Keyflow null objects (parenting): each folder's layers get `parentId` = the folder's null, nested folders give nested nulls, and each null starts at the centre of its folder's contents.
A null is a 200×200 box placed by its top-left corner; a parented layer's position is measured from its parent null's centre (otherwise from the canvas centre).
Format notes: `.kf` is a zip (`manifest.json`, `project.json`, `thumbnail.jpg`, `media/*.png` stored uncompressed). Layer position is the
layer's top-left corner measured from the canvas centre, Y down; the layer list is top-first.

## Use on your phone
Open **https://punyopan.github.io/psd-to-am-xml/**, pick a .psd, download the XML (or the .zip with layer PNGs). Runs entirely in the browser.

## Usage (command line)
```
pip install psd-tools
python psd2am.py design.psd out.xml [--duration-ms 5000] [--fps 30]
```

## Format notes
- `location` = layer center in canvas pixels, y down
- Layers listed bottom → top
- Colors are `#AARRGGBB`
- Media is referenced by device URI (`content://...`), not embedded
