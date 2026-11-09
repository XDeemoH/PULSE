    // #region vendor-contour-field
    var ContourEngine = (function () {
      /** Seeded contour artwork. Dependency-free ESM; WebGL + editable SVG fallback. */
      const DEFAULT_OPTIONS = Object.freeze({
        field: Object.freeze({ scale: Object.freeze([3.7, 4.93]), octaves: 3, bands: 48, warp: 1.35, speed: 0.018, seed: 721 }),
        style: Object.freeze({ color: '#b8bdbb', background: '#111416', alpha: 0.64, lineWidth: 0.85, softness: 0.8,
          fade: Object.freeze([0.48, 0.82]), edgeFade: 0.10, dashed: true, accentColor: '#b9701a', accent: 0, tile: false }),
        respectReducedMotion: true, motion: true, fps: 30, maxDpr: 2, renderer: 'auto',
      });
      const number = (v, fallback, min, max) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
      const hex = (v, fallback) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
      const pair = (v, fallback, min, max) => [0, 1].map(i => number(Array.isArray(v) ? v[i] : undefined, fallback[i], min, max));
      function normalizeOptions(patch = {}, base = DEFAULT_OPTIONS) {
        const p = patch && typeof patch === 'object' ? patch : {}, f = p.field || {}, s = p.style || {}, b = base.field, t = base.style;
        const fade = pair(s.fade, t.fade, 0, 1.5).sort((a, b) => a - b);
        if (fade[1] - fade[0] < 0.01) fade[1] = fade[0] + 0.01;
        return {
          field: { scale: pair(f.scale, b.scale, 0.5, 12), octaves: Math.round(number(f.octaves, b.octaves, 1, 6)),
            bands: number(f.bands, b.bands, 4, 96), warp: number(f.warp, b.warp, 0, 4),
            speed: number(f.speed, b.speed, 0, 0.15), seed: Math.floor(number(f.seed, b.seed, 0, 999999)) },
          style: { color: hex(s.color, t.color), background: hex(s.background, t.background),
            alpha: number(s.alpha, t.alpha, 0, 1), lineWidth: number(s.lineWidth, t.lineWidth, 0.25, 4),
            softness: number(s.softness, t.softness, 0.1, 2), fade, edgeFade: number(s.edgeFade, t.edgeFade, 0, 0.4),
            dashed: typeof s.dashed === 'boolean' ? s.dashed : t.dashed,
            accentColor: hex(s.accentColor, t.accentColor), accent: number(s.accent, t.accent, 0, 1),
            tile: typeof s.tile === 'boolean' ? s.tile : t.tile },
          respectReducedMotion: typeof p.respectReducedMotion === 'boolean' ? p.respectReducedMotion : base.respectReducedMotion,
          motion: typeof p.motion === 'boolean' ? p.motion : base.motion,
          fps: number(p.fps, base.fps, 1, 60), maxDpr: number(p.maxDpr, base.maxDpr, 1, 2),
          renderer: ['auto', 'svg'].includes(p.renderer) ? p.renderer : base.renderer,
        };
      }
      const fract = x => x - Math.floor(x);
      const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
      const mix = (a, b, t) => a + (b - a) * t;
      function noise(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
        return mix(mix(hash(ix, iy), hash(ix + 1, iy), ux), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux), uy);
      }
      function fbm(x, y, octaves) {
        let v = 0, a = 0.5, total = 0;
        for (let i = 0; i < octaves; i++) {
          v += a * noise(x, y); total += a;
          const nx = (x * 0.8 + y * 0.6) * 2.02 + 8.1;
          y = (-x * 0.6 + y * 0.8) * 2.02 + 3.7; x = nx; a *= 0.5;
        }
        return v / total;
      }
      /** CPU field for vector export and static fallback. */
      function sampleField(x, y, time = 0, options = DEFAULT_OPTIONS) {
        const f = options.field, t = time * f.speed;
        const px = x * f.scale[0] + (f.seed % 997) * 0.013, py = y * f.scale[1] + Math.floor(f.seed / 997) * 0.017;
        const dx = Math.sin(t * 0.71) * 0.48, dy = Math.cos(t * 0.53) * 0.48;
        const qx = fbm(px + dx, py + dy, f.octaves) - 0.5, qy = fbm(px + 5.2 - dx * 0.73, py + 1.3 - dy * 0.73, f.octaves) - 0.5;
        const wx = px + f.warp * qx, wy = py + f.warp * qy;
        return fbm(wx, wy, f.octaves) * 0.78 + fbm(wx * 0.57 + 8.1, wy * 0.57 + 2.3, f.octaves) * 0.22;
      }
      function contourPaths(o, width, height, time) {
        const nx = Math.max(24, Math.min(150, Math.round(width / 11))), ny = Math.max(24, Math.round(nx * height / width));
        const values = new Float64Array((nx + 1) * (ny + 1));
        let min = Infinity, max = -Infinity;
        for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
          const v = sampleField(x / nx, y / ny, time, o) * o.field.bands;
          values[y * (nx + 1) + x] = v; min = Math.min(min, v); max = Math.max(max, v);
        }
        const paths = [];
        for (let level = Math.ceil(min); level <= Math.floor(max); level++) {
          const segments = [], links = new Map();
          const add = (a, b) => {
            const i = segments.push([a, b]) - 1;
            for (const p of [a, b]) { if (!links.has(p.key)) links.set(p.key, []); links.get(p.key).push(i); }
          };
          for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
            const off = y * (nx + 1) + x, tl = values[off], tr = values[off + 1], bl = values[off + nx + 1], br = values[off + nx + 2];
            if (level < Math.min(tl, tr, bl, br) || level > Math.max(tl, tr, bl, br)) continue;
            const edges = [];
            const cross = (a, b, key, ax, ay, bx, by) => {
              if ((a >= level) === (b >= level)) return;
              const t = (level - a) / (b - a);
              edges.push({ key, x: (ax + (bx - ax) * t) * width / nx, y: (ay + (by - ay) * t) * height / ny });
            };
            cross(tl, tr, 'h' + x + ',' + y, x, y, x + 1, y);
            cross(tr, br, 'v' + (x + 1) + ',' + y, x + 1, y, x + 1, y + 1);
            cross(bl, br, 'h' + x + ',' + (y + 1), x, y + 1, x + 1, y + 1);
            cross(tl, bl, 'v' + x + ',' + y, x, y, x, y + 1);
            if (edges.length === 2) add(edges[0], edges[1]);
            if (edges.length === 4) {
              const connected = (tl >= level) === ((tl + tr + bl + br) / 4 >= level);
              if (connected) { add(edges[0], edges[1]); add(edges[2], edges[3]); }
              else { add(edges[0], edges[3]); add(edges[1], edges[2]); }
            }
          }
          const used = new Uint8Array(segments.length);
          const trace = (segmentIndex, endpoint) => {
            const points = [endpoint]; let current = endpoint, index = segmentIndex;
            while (index !== undefined && !used[index]) {
              used[index] = 1;
              const s = segments[index], next = s[0].key === current.key ? s[1] : s[0];
              points.push(next); current = next; index = links.get(next.key).find(i => !used[i]);
            }
            if (points.length < 3) return;
            const closed = points[0].key === points[points.length - 1].key;
            const d = points.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)).join('') + (closed ? 'Z' : '');
            paths.push({ level, d });
          };
          for (const [key, indices] of links) if (indices.length === 1 && !used[indices[0]]) {
            const s = segments[indices[0]]; trace(indices[0], s[0].key === key ? s[0] : s[1]);
          }
          for (let i = 0; i < segments.length; i++) if (!used[i]) trace(i, segments[i][0]);
        }
        return paths;
      }
      function buildContourSVG(settings = {}, { width = 1536, height = 2048, time = 0, transparent = false } = {}) {
        const o = normalizeOptions(settings), s = o.style;
        width = Math.round(number(width, 1536, 16, 8192)); height = Math.round(number(height, 2048, 16, 8192)); time = number(time, 0, 0, 1000000);
        const edge = Math.max(0.1, s.edgeFade * 100);
        const paths = contourPaths(o, width, height, time).map(({ level, d }) => {
          const major = level % 5 === 0, dash = s.dashed && level % 5 === 2 ? ' stroke-dasharray="5 5"' : '';
          return '<path d="' + d + '" stroke-width="' + (s.lineWidth * (major ? 1.65 : 1)).toFixed(3) +
            '" stroke-opacity="' + (s.alpha * (major ? 1 : 0.68)).toFixed(3) + '"' + dash + '/>';
        }).join('');
        const stops = '<stop offset="0" stop-color="black"/><stop offset="' + edge + '%" stop-color="white"/>' +
          '<stop offset="' + (100 - edge) + '%" stop-color="white"/><stop offset="100%" stop-color="black"/>';
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
          '<defs><linearGradient id="cx">' + stops + '</linearGradient><linearGradient id="cy" x1="0" y1="0" x2="0" y2="1">' + stops +
          '</linearGradient><mask id="mx"><rect width="100%" height="100%" fill="url(#cx)"/></mask>' +
          '<mask id="my"><rect width="100%" height="100%" fill="url(#cy)"/></mask></defs>' +
          (transparent ? '' : '<rect width="100%" height="100%" fill="' + s.background + '"/>') +
          '<g mask="url(#mx)"><g mask="url(#my)" fill="none" stroke="' + s.color + '" stroke-linecap="round" stroke-linejoin="round">' + paths + '</g></g></svg>';
      }
      
      const VERTEX = 'attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}';
      const FRAGMENT = [
        '#extension GL_OES_standard_derivatives : enable',
        '#ifdef GL_FRAGMENT_PRECISION_HIGH',
        'precision highp float;',
        '#else',
        'precision mediump float;',
        '#endif',
        'uniform vec2 u_res; uniform float u_dpr,u_time; uniform vec2 u_scale;',
        'uniform float u_octaves,u_bands,u_warp,u_speed,u_seed;',
        'uniform vec3 u_color,u_background,u_accentColor;',
        'uniform float u_alpha,u_lineWidth,u_softness,u_edgeFade,u_dashed,u_accent,u_transparent,u_tile; uniform vec2 u_fade;',
        'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
        'float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);',
        'return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}',
        'float fbm(vec2 p){float v=0.,a=.5,total=0.;for(int i=0;i<6;i++){if(float(i)>=u_octaves)break;',
        'v+=a*noise(p);total+=a;p=mat2(.8,-.6,.6,.8)*p*2.02+vec2(8.1,3.7);a*=.5;}return v/total;}',
        'void main(){vec2 uv=vec2(gl_FragCoord.x/u_res.x,1.-gl_FragCoord.y/u_res.y);',
        'vec2 p=vec2(gl_FragCoord.x,gl_FragCoord.y)/u_res.y*u_scale.y+vec2(mod(u_seed,997.)*.013,floor(u_seed/997.)*.017);float t=u_time*u_speed;',
        'vec2 drift=vec2(sin(t*.71),cos(t*.53))*.48;vec2 q=vec2(fbm(p+drift),fbm(p+vec2(5.2,1.3)-drift*.73))-.5;',
        'vec2 w=p+u_warp*q;float f=fbm(w)*.78+fbm(w*.57+vec2(8.1,2.3))*.22;',
        'float level=f*u_bands,idx=floor(level+.5),dist=abs(level-idx);',
        'float grad=max(length(vec2(dFdx(level),dFdy(level))),.00001);',
        'float major=1.-step(.5,mod(idx,5.));float halfWidth=u_lineWidth*u_dpr*mix(1.,1.65,major)*.5;float soft=u_softness*u_dpr*.5;',
        'float line=1.-smoothstep(max(0.,halfWidth-soft)*grad,(halfWidth+soft)*grad,dist);',
        'float dashLine=1.-step(.5,abs(mod(idx,5.)-2.));float dash=smoothstep(-.15,.15,sin((p.x+p.y*.8)*72.));',
        'line*=mix(1.,dash,u_dashed*dashLine);float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));',
        'float fade=1.;if(u_tile<.5){fade=smoothstep(.012,max(.013,u_edgeFade),edge);',
        'fade*=1.-smoothstep(u_fade.x,u_fade.y,length((uv-.5)*vec2(1.1,1.)));}',
        'float alpha=line*fade*u_alpha*mix(.68,1.,major);',
        'float sweep=pow(max(0.,sin(p.x*.8+p.y*.3-u_time*.12)),24.)*u_accent;',
        'vec3 color=mix(u_color,u_accentColor,sweep);',
        'if(u_transparent>.5)gl_FragColor=vec4(color,alpha);else gl_FragColor=vec4(mix(u_background,color,alpha),1.);}',
      ].join('\n');
      const rgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
      function makeGL(canvas, initial) {
        const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, depth: false, stencil: false });
        if (!gl || !gl.getExtension('OES_standard_derivatives')) throw new Error('WebGL derivatives unavailable');
        const shaders = []; let program, buffer;
        const dispose = () => { if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); for (const shader of shaders) gl.deleteShader(shader); };
        try {
          const compile = (type, source) => { const s = gl.createShader(type); shaders.push(s); gl.shaderSource(s, source); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
          program = gl.createProgram(); gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
          gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
          gl.useProgram(program); gl.disable(gl.DITHER); gl.disable(gl.BLEND);
          buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
          const a = gl.getAttribLocation(program, 'a_position'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
          const uniforms = {};
          for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) { const name = gl.getActiveUniform(program, i).name; uniforms[name] = gl.getUniformLocation(program, name); }
          let options, color, background, accentColor;
          const update = next => { options = next; color = rgb(next.style.color); background = rgb(next.style.background); accentColor = rgb(next.style.accentColor); };
          update(initial);
          const draw = (time, width, height, dpr = 1, transparent = false) => {
            const f = options.field, s = options.style, u = uniforms;
            gl.useProgram(program); gl.viewport(0, 0, width, height);
            gl.uniform2f(u.u_res, width, height); gl.uniform1f(u.u_time, time); gl.uniform1f(u.u_dpr, dpr);
            gl.uniform2f(u.u_scale, f.scale[0], f.scale[1]); gl.uniform1f(u.u_octaves, f.octaves); gl.uniform1f(u.u_bands, f.bands);
            gl.uniform1f(u.u_warp, f.warp); gl.uniform1f(u.u_speed, f.speed); gl.uniform1f(u.u_seed, f.seed);
            gl.uniform3f(u.u_color, color[0], color[1], color[2]); gl.uniform3f(u.u_background, background[0], background[1], background[2]);
            gl.uniform3f(u.u_accentColor, accentColor[0], accentColor[1], accentColor[2]);
            gl.uniform1f(u.u_alpha, s.alpha); gl.uniform1f(u.u_lineWidth, s.lineWidth); gl.uniform1f(u.u_softness, s.softness);
            gl.uniform2f(u.u_fade, s.fade[0], s.fade[1]); gl.uniform1f(u.u_edgeFade, s.edgeFade);
            gl.uniform1f(u.u_dashed, s.dashed ? 1 : 0); gl.uniform1f(u.u_accent, s.accent); gl.uniform1f(u.u_transparent, transparent ? 1 : 0);
            gl.uniform1f(u.u_tile, s.tile ? 1 : 0);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
          };
          return { draw, update, destroy: dispose, release: () => gl.getExtension('WEBGL_lose_context')?.loseContext() };
        } catch (error) { dispose(); throw error; }
      }
      const clone = v => JSON.parse(JSON.stringify(v));
      const canvasBlob = c => new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
      async function svgToPNG(svg, width, height) {
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const image = new Image(), canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        try {
          await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('SVG rasterization failed')); image.src = url; });
          canvas.getContext('2d').drawImage(image, 0, 0, width, height); return await canvasBlob(canvas);
        } finally { URL.revokeObjectURL(url); }
      }
      function createContourField({ canvas, onStateChange, ...settings } = {}) {
        if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('A canvas is required');
        const doc = canvas.ownerDocument, win = doc.defaultView;
        let options = normalizeOptions(settings), gpu = null, backend = 'svg', error = '';
        let destroyed = false, requested = options.motion, raf = 0, frames = 0, time = 0, lastStamp = null, lastDraw = -Infinity;
        let width = 1, height = 1, dpr = 1, fallback = null, band = null, bandAnimation = null, fallbackTimer = 0;
        const originalVisibility = canvas.style.visibility, parent = canvas.parentElement, originalPosition = parent?.style.position;
        const media = win.matchMedia('(prefers-reduced-motion: reduce)');
        const notify = () => { if (onStateChange) onStateChange(api.getState()); };
        const allowed = () => requested && options.motion && (options.field.speed > 0 || options.style.accent > 0) && !doc.hidden && !(options.respectReducedMotion && media.matches) &&
          canvas.closest('[data-motion]')?.getAttribute('data-motion') !== 'off';
        function clearFallback() {
          if (fallbackTimer) win.clearTimeout(fallbackTimer); fallbackTimer = 0;
          bandAnimation?.cancel(); bandAnimation = null; fallback?.remove(); fallback = null; band = null; canvas.style.visibility = originalVisibility;
        }
        function refreshFallback() {
          if (destroyed || backend !== 'svg' || !parent) return;
          if (!fallback) {
            if (win.getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
            fallback = doc.createElement('div'); fallback.setAttribute('aria-hidden', 'true'); fallback.dataset.contourFallback = '';
            Object.assign(fallback.style, { position: 'absolute', overflow: 'hidden', pointerEvents: 'none' }); parent.append(fallback);
          }
          const cw = canvas.clientWidth || 480, ch = canvas.clientHeight || 640;
          Object.assign(fallback.style, { left: canvas.offsetLeft + 'px', top: canvas.offsetTop + 'px', width: cw + 'px', height: ch + 'px', backgroundColor: options.style.background });
          canvas.style.visibility = 'hidden';
          const svg = buildContourSVG(options, { width: Math.round(cw), height: Math.round(ch), time, transparent: true });
          fallback.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")'; fallback.style.backgroundSize = '100% 100%';
          bandAnimation?.cancel(); band?.remove(); band = doc.createElement('div');
          const mask = buildContourSVG({ ...options, style: { ...options.style, color: '#ffffff', alpha: 1 } }, { width: Math.round(cw), height: Math.round(ch), time, transparent: true });
          Object.assign(band.style, { position: 'absolute', inset: '0', opacity: String(options.style.alpha * options.style.accent),
            maskImage: 'url("data:image/svg+xml,' + encodeURIComponent(mask) + '")', maskSize: '100% 100%' });
          const beam = doc.createElement('div');
          Object.assign(beam.style, { position: 'absolute', inset: '-10% auto -10% -45%', width: '45%', background: 'linear-gradient(90deg,transparent,' + options.style.accentColor + ',transparent)' });
          band.append(beam); fallback.append(band);
          bandAnimation = beam.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(420%)' }], { duration: 11000, iterations: Infinity });
          if (!allowed() || options.style.accent === 0) bandAnimation.pause();
        }
        function draw() { if (destroyed) return; if (gpu) gpu.draw(time, width, height, dpr); frames++; }
        function tick(stamp) {
          raf = 0; if (destroyed || !allowed() || backend !== 'webgl') return;
          if (lastStamp !== null) time += Math.min(0.15, Math.max(0, (stamp - lastStamp) / 1000)); lastStamp = stamp;
          if (stamp - lastDraw >= 1000 / options.fps - 0.5) { draw(); lastDraw = stamp; }
          raf = win.requestAnimationFrame(tick);
        }
        function syncMotion() {
          if (raf) win.cancelAnimationFrame(raf); raf = 0; lastStamp = null; lastDraw = -Infinity;
          if (!destroyed && allowed()) { if (backend === 'webgl') raf = win.requestAnimationFrame(tick); else if (options.style.accent > 0) bandAnimation?.play(); else bandAnimation?.pause(); }
          else bandAnimation?.pause(); notify();
        }
        function resize() {
          if (destroyed) return;
          const rect = canvas.getBoundingClientRect(); dpr = Math.min(win.devicePixelRatio || 1, options.maxDpr, 2);
          width = Math.max(1, Math.round((rect.width || 480) * dpr)); height = Math.max(1, Math.round((rect.height || 640) * dpr));
          if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
          if (backend === 'svg') refreshFallback(); else draw();
        }
        function selectBackend() {
          gpu?.destroy(); gpu = null; clearFallback();
          if (options.renderer === 'auto') {
            try { gpu = makeGL(canvas, options); backend = 'webgl'; error = ''; } catch (reason) { backend = 'svg'; error = String(reason.message || reason); }
          } else { backend = 'svg'; error = ''; }
        }
        const contextLost = event => { event.preventDefault(); gpu = null; backend = 'svg'; error = 'WebGL context lost'; refreshFallback(); syncMotion(); };
        const contextRestored = () => { if (!destroyed) { selectBackend(); resize(); syncMotion(); } };
        const api = {
          setOptions(patch) {
            if (destroyed) return;
            const previous = options; options = normalizeOptions(patch, options);
            if (options.renderer !== previous.renderer) selectBackend(); else gpu?.update(options);
            if (backend === 'svg') {
              if (fallbackTimer) win.clearTimeout(fallbackTimer);
              fallbackTimer = win.setTimeout(() => { fallbackTimer = 0; refreshFallback(); syncMotion(); }, 60);
            } else if (options.maxDpr !== previous.maxDpr) resize(); else draw();
            syncMotion();
          },
          getOptions: () => clone(options),
          getState: () => ({ backend, running: !destroyed && allowed() && (backend === 'webgl' ? raf !== 0 : bandAnimation?.playState === 'running'),
            requestedRunning: requested, time, frames, width, height, dpr, destroyed, reducedMotion: media.matches, error }),
          start() { if (!destroyed) { requested = true; syncMotion(); } },
          stop() { requested = false; syncMotion(); },
          renderAt(seconds = 0) {
            if (destroyed) throw new Error('Contour field has been destroyed');
            requested = false; time = number(seconds, 0, 0, 1000000); syncMotion(); if (backend === 'svg') refreshFallback(); else draw();
          },
          exportSVG({ width = 1536, height = 2048, time: at = time, transparent = false, ...patch } = {}) {
            return buildContourSVG(normalizeOptions(patch, options), { width, height, time: at, transparent });
          },
          async exportPNG({ width: w = 1536, height: h = 2048, time: at = time, transparent = false, ...patch } = {}) {
            if (destroyed) throw new Error('Contour field has been destroyed');
            w = Math.round(number(w, 1536, 16, 8192)); h = Math.round(number(h, 2048, 16, 8192));
            at = number(at, time, 0, 1000000);
            const snapshot = normalizeOptions(patch, options), target = doc.createElement('canvas'); target.width = w; target.height = h;
            if (backend === 'svg') return svgToPNG(buildContourSVG(snapshot, { width: w, height: h, time: at, transparent }), w, h);
            let exporter;
            try { exporter = makeGL(target, snapshot); exporter.draw(at, w, h, 1, transparent); return await canvasBlob(target); }
            finally { exporter?.destroy(); exporter?.release(); }
          },
          destroy() {
            if (destroyed) return; requested = false; if (raf) win.cancelAnimationFrame(raf); raf = 0; destroyed = true;
            observer.disconnect(); motionObserver.disconnect(); media.removeEventListener('change', syncMotion);
            doc.removeEventListener('visibilitychange', syncMotion); win.removeEventListener('resize', resize);
            canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
            gpu?.destroy(); gpu = null; clearFallback(); if (parent) parent.style.position = originalPosition;
          },
        };
        const observer = new win.ResizeObserver(resize), motionObserver = new win.MutationObserver(syncMotion);
        for (let node = canvas; node; node = node.parentElement) motionObserver.observe(node, { attributes: true, attributeFilter: ['data-motion'] });
        selectBackend(); resize(); observer.observe(canvas); media.addEventListener('change', syncMotion); doc.addEventListener('visibilitychange', syncMotion);
        win.addEventListener('resize', resize); canvas.addEventListener('webglcontextlost', contextLost); canvas.addEventListener('webglcontextrestored', contextRestored);
        syncMotion(); return api;
      }
      
      return { DEFAULT_OPTIONS: DEFAULT_OPTIONS, normalizeOptions: normalizeOptions, sampleField: sampleField, buildContourSVG: buildContourSVG, createContourField: createContourField }
    })()
    // #endregion vendor-contour-field

