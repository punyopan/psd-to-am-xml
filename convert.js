// Shared converter: ag-psd document -> Alight Motion XML. Works in browser and Node.
(function (root) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const argb = (c, a = 255) => c ? `#${hex(a)}${hex(c.r)}${hex(c.g)}${hex(c.b)}` : '#ff000000';
  const f = n => Number(n).toFixed(6);
  // Photoshop blend mode -> Alight Motion `blending` value (names confirmed from Alight Motion exports);
  // other modes fall back to normal and are reported.
  const BLEND = {
    'normal': null, 'pass through': null,
    'multiply': 'multiply', 'screen': 'screen', 'overlay': 'overlay',
    'darken': 'darken', 'lighten': 'lighten', 'subtract': 'subtract',
    'color dodge': 'color-dodge', 'color burn': 'color-burn',
    'hard light': 'hard-light', 'soft light': 'soft-light',
    'difference': 'diff', 'exclusion': 'exclusion',
  };
  const layerAttrs = (l, notes) => {
    let a = '';
    if (l.clipping) a += ' clippingMask="true"';
    const bm = l.blendMode || 'normal';
    if (bm in BLEND) { if (BLEND[bm]) a += ` blending="${BLEND[bm]}"`; }
    else notes.push(`${l.name}: blend mode "${bm}" not supported yet, set to normal`);
    return a;
  };
  // Alight Motion's rect `size` is HALF the width/height (a 2000px-tall image filling a 2160px scene is saved as size 1080).
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
        x.push(`  <text id="${id}" label="${name}" startTime="0" endTime="${T}"${layerAttrs(l, skipped)} fillType="color" mediaFillMode="fill" size="${f(size)}" font="googlefonts?name=Roboto&amp;weight=400" wrapWidth="${Math.max(Math.round(w), 64)}" align="left">\n    ${tr}\n    <fillColor value="${argb(st.fillColor)}" />\n    <content>${esc(l.text.text.replace(/\r/g, '\n'))}</content>\n  </text>`);
      } else {
        const file = `${id}_${(l.name || 'layer').replace(/[^A-Za-z0-9\-_]/g, '_')}${opts.tag ? '_' + opts.tag : ''}.png`;
        const uri = uriFor(file, opts);
        if (opts.mediaList) media.push(`  <media uri="${esc(uri)}" filename="${esc(file)}" title="${esc(file)}" type="image/png" orientation="0" width="${Math.round(w)}" height="${Math.round(h)}" />`);
        x.push(`  <shape id="${id}" label="${name}" startTime="0" endTime="${T}"${layerAttrs(l, skipped)} fillType="media" fillImage="${esc(uri)}" mediaFillMode="fill" s=".rect">\n    ${tr}\n    <property name="size" type="vec2" value="${f(w / 2)},${f(h / 2)}" />\n  </shape>`);
        pixel.push({ id, layer: l, file, uri });
      }
    }
    x.splice(2, 0, ...media);
    x.push('</scene>');
    return { xml: x.join('\n'), pixel, count: layers.length, skipped };
  }


  // ---------- Keyflow (.kf) ----------
  // A .kf file is a zip: manifest.json + project.json + thumbnail.jpg + media/*.png (images stored inside).
  // Layer position = top-left corner of the layer, measured from the canvas centre, Y down
  // (confirmed: a PSD layer covering a 2000x2000 canvas is saved at -1000,-1000).
  // Layer list is top-first. Blend modes use Photoshop-style names ("Linear Burn").
  const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());
  function flattenAll(layers, out) {           // keeps hidden layers (Keyflow has a visibility flag)
    for (const l of layers || []) {
      if (l.children) { flattenAll(l.children, out); continue; }
      const w = (l.right || 0) - (l.left || 0), h = (l.bottom || 0) - (l.top || 0);
      if (w > 0 && h > 0) out.push(l);
    }
    return out;
  }
  function convertKeyflow(psd, opts = {}) {
    const W = psd.width, H = psd.height, now = opts.now || Date.now();
    const notes = [];
    const maps = { transformX: {}, transformY: {}, scale: {}, rotate: {}, anchorX: {}, anchorY: {}, opacity: {}, visibility: {}, blendMode: {} };
    const layers = [], media = [], assets = {};
    let n = 0;
    for (const l of flattenAll(psd.children, [])) {
      if (l.empty) { notes.push(`${l.name}: empty`); continue; }
      if (!l.canvas) { notes.push(`${l.name}: no pixel data, skipped`); continue; }
      if (l.clipping) notes.push(`${l.name}: clipping mask not supported in Keyflow export yet, imported unclipped`);
      if (l.clipBaked) notes.push(`${l.name}: clipping applied to the image (Keyflow has no clipping masks)`);
      n++;
      const id = `img_${now + n}`, file = `img_${now + 100 + n}.png`;
      const w = l.right - l.left, h = l.bottom - l.top;
      layers.push({ id, name: l.name || `Layer ${n}`, type: 'IMAGE', isLocked: false, inPointMs: 0, outPointMs: opts.durationMs || 5000,
                    content: { kind: 'IMAGE', assetPath: `keyflow:/asset/${file}`, width: w, height: h } });
      maps.transformX[id] = String(Math.round(l.left - W / 2));
      maps.transformY[id] = String(Math.round(l.top - H / 2));
      maps.scale[id] = '100'; maps.rotate[id] = '0'; maps.anchorX[id] = '0.5'; maps.anchorY[id] = '0.5';
      maps.opacity[id] = String(l.opacity !== undefined ? +l.opacity.toFixed(4) : 1.0).replace(/^1$/, '1.0');
      maps.visibility[id] = l.hidden ? 'false' : 'true';
      const bm = l.blendMode || 'normal';
      if (bm !== 'normal' && bm !== 'pass through') maps.blendMode[id] = titleCase(bm);
      assets[file] = `/data/user/0/com.angkin.keyflow/files/${file}`;
      media.push({ file, layer: l });
    }
    layers.reverse();                          // PSD is bottom-first, Keyflow is top-first
    // Like Keyflow's own PSD import: wrap everything in one group named after the file, at 0,0
    if (layers.length && opts.group !== false) {
      const gid = `group_${now}`;
      for (const l of layers) l.groupId = gid;
      layers.unshift({ id: gid, name: opts.title || 'PSD', type: 'GROUP', isLocked: false, inPointMs: 0, outPointMs: opts.durationMs || 5000,
        content: { kind: 'GROUP', childIds: layers.map(l => l.id), anchorX: 0, anchorY: 0, collapse: false, cameraPassThrough: false } });
      Object.assign(maps.transformX, { [gid]: '0' }); maps.transformY[gid] = '0'; maps.scale[gid] = '100'; maps.rotate[gid] = '0';
      maps.anchorX[gid] = '0.5'; maps.anchorY[gid] = '0.5'; maps.opacity[gid] = '1.0'; maps.visibility[gid] = 'true';
    }
    const project = { layers, ...maps, transformZ: {}, rotateX: {}, rotateY: {}, scaleY: {},
      blendOpacity: {}, blendStrength: {}, maskMode: {}, motionBlur: {}, shutterAngle: 180, backgroundColor: 4279900701,
      textPxPerUnit: 2.75, markers: [], volume: {}, gridVisible: false, previewQuality: 'Full', groupSpanGates: true,
      kfPosX: {}, kfPosY: {}, kfPosZ: {}, kfScale: {}, kfScaleY: {}, kfRotate: {}, kfRotateX: {}, kfRotateY: {},
      kfOpacity: {}, kfAnchorX: {}, kfAnchorY: {}, kfStrength: {} };
    const manifest = { format: 1, exportedAt: now, app: '1.5.10', build: 39, includesMedia: true, device: 'psd-to-am-xml',
      project: { name: opts.title || 'PSD Import', fps: opts.fps || 30, ratio: opts.ratio || '3:4', resolution: opts.resolution || '1080p', createdAt: now },
      assets };
    return { project, manifest, media, notes, count: media.length };
  }

  if (typeof module !== 'undefined') module.exports = { convert, convertKeyflow };
  else root.PSD2AM = { convert, convertKeyflow };
})(this);
