# psd-to-am-xml

Convert a Photoshop `.psd` into an Alight Motion project `.xml`.

## Status
- **Image layers** → Alight Motion image layers (position, size, opacity), each exported as a PNG
- **Text layers** → Alight Motion text layers (position, size, color, content; font defaults to Roboto)
- Hidden layers skipped
- Not handled yet: clipping masks, blend modes, layer effects
- The XML points at PNGs in `/storage/emulated/0/Download/` with `file://` paths (confirmed working in Alight Motion 5.0.273 on Android). Extract the zip so the PNGs sit directly in Download, then import the XML. Use `--folder` in the Python script for a different folder.

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
