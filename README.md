# psd-to-am-xml

Convert a Photoshop `.psd` into an Alight Motion project `.xml`.

## Status (v0)
- **Text layers** → Alight Motion text layers (position, size, color, content; font defaults to Roboto)
- **Pixel layers** → magenta rectangle placeholders at the same position/size, plus each layer exported as a PNG next to the XML
- Not handled: blend modes, layer effects, masks, hidden layers
- Real image layers: pending a sample Alight Motion XML containing an image layer

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
