// Shared converter: ag-psd document -> Alight Motion XML. Works in browser and Node.
(function (root) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const argb = (c, a = 255) => c ? `#${hex(a)}${hex(c.r)}${hex(c.g)}${hex(c.b)}` : '#ff000000';
  const f = n => Number(n).toFixed(6);
  // Where Alight Motion should look for each PNG. Android assigns content:// IDs on save,
  // so we can only point at a known folder path.
  const uriFor = (file, opts) => {
    const dir = (opts.folder || '/storage/emulated/0/Download').replace(/\/$/, '');
    const scheme = opts.uriScheme || 'file';
    if (scheme === 'path') return `${dir}/${file}`;
    if (scheme === 'saf') return `content://com.android.externalstorage.documents/document/primary%3A${encodeURIComponent(dir.replace('/storage/emulated/0/', '') + '/' + file)}`;
    return `file://${dir}/${file}`;
  };

  function flatten(layers, out, skipped = []) {
    for (const l of layers || []) {
      if (l.hidden) { skipped.push(`${l.name}: hidden`); continue; }
      if (l.empty) { skipped.push(`${l.name}: empty`); continue; }
      if (l.clipping) skipped.push(`${l.name}: clipping mask not supported, imported unclipped`);
      if (l.children) { flatten(l.children, out, skipped); continue; }
      const w = (l.right || 0) - (l.left || 0), h = (l.bottom || 0) - (l.top || 0);
      if (w <= 0 || h <= 0) continue;
      out.push(l);
    }
    return out;
  }

  function convert(psd, opts = {}) {
    const W = psd.width, H = psd.height, T = opts.durationMs || 5000, fps = opts.fps || 30;
    const pixel = [], media = [], skipped = [];
    const layers = flatten(psd.children, [], skipped); // ag-psd: index 0 = bottom, same as AM
    const x = [`<?xml version='1.0' encoding='UTF-8' ?>`,
      `<scene title="${esc(opts.title || 'PSD Import')}" width="${W}" height="${H}" exportWidth="${W}" exportHeight="${H}" precompose="dynamicResolution" bgcolor="#ff000000" totalTime="${T}" fps="${fps}" modifiedTime="0" amver="1028417" ffver="106" am="com.alightcreative.motion/5.0.273.1028417" amplatform="android" retime="freeze" retimeAdaptFPS="false">`];
    let id = 1000;
    for (const l of layers) {
      id++;
      const w = l.right - l.left, h = l.bottom - l.top;
      const cx = l.left + w / 2, cy = l.top + h / 2;
      const op = l.opacity !== undefined && l.opacity < 1 ? `\n      <opacity value="${f(l.opacity)}" />` : '';
      const tr = `<transform>\n      <location value="${f(cx)},${f(cy)},0.000000" />${op}\n    </transform>`;
      const name = esc(l.name || `Layer ${id}`);
      if (l.text && l.text.text != null) {
        const st = l.text.style || {};
        const size = st.fontSize || 24;
        x.push(`  <text id="${id}" label="${name}" startTime="0" endTime="${T}" fillType="color" mediaFillMode="fill" size="${f(size)}" font="googlefonts?name=Roboto&amp;weight=400" wrapWidth="${Math.max(Math.round(w), 64)}" align="left">\n    ${tr}\n    <fillColor value="${argb(st.fillColor)}" />\n    <content>${esc(l.text.text.replace(/\r/g, '\n'))}</content>\n  </text>`);
      } else {
        const file = `${id}_${(l.name || 'layer').replace(/[^A-Za-z0-9\-_]/g, '_')}.png`;
        const uri = uriFor(file, opts);
        media.push(`  <media uri="${esc(uri)}" filename="${esc(file)}" title="${esc(file)}" type="image/png" orientation="0" width="${Math.round(w)}" height="${Math.round(h)}" />`);
        x.push(`  <shape id="${id}" label="${name}" startTime="0" endTime="${T}" fillType="media" fillImage="${esc(uri)}" mediaFillMode="fill" s=".rect">\n    ${tr}\n    <property name="size" type="vec2" value="${f(w)},${f(h)}" />\n  </shape>`);
        pixel.push({ id, layer: l, file, uri });
      }
    }
    x.splice(2, 0, ...media);
    x.push('</scene>');
    return { xml: x.join('\n'), pixel, count: layers.length, skipped };
  }

  if (typeof module !== 'undefined') module.exports = { convert };
  else root.PSD2AM = { convert };
})(this);
