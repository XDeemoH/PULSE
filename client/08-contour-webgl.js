    /* ── WebGL 等高线（域扭曲噪声 → 等值带） ─────────────────────────── */

    var GL_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}'
    var GL_FRAG = [
      'precision mediump float;',
      'uniform vec2 u_res;',
      'uniform float u_time;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
      ' return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
      'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.02;a*=0.5;}return v;}',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/u_res;',
      ' vec2 p=uv*vec2(2.6,3.6);',
      ' float t=u_time*0.018;',
      ' vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));',
      ' float f=fbm(p+1.8*q);',
      ' float band=abs(fract(f*8.0)-0.5);',
      ' float line=smoothstep(0.455,0.5,band);',
      ' vec2 d=uv-0.5;',
      ' float fade=1.0-smoothstep(0.22,0.52,length(d*vec2(1.1,1.0)));',
      ' float a=line*fade*0.18; gl_FragColor=vec4(vec3(0.5)*a,a);',
      '}',
    ].join('\n')

    /**
     * WebGL 等高线层：域扭曲 FBM 取等值带，条带随 time 缓慢流动（真·变形）。
     * 任何一步失败都静默回退到 SVG 层；只在可见且启用时跑 rAF。
     */
    function ContourGL(props) {
      var ref = React.useRef(null)
      var failPair = React.useState(false)
      var failed = failPair[0]
      var setFailed = failPair[1]
      React.useEffect(
        function () {
          var canvas = ref.current
          if (!canvas || typeof window === 'undefined') return undefined
          var gl = null
          var program = null
          var raf = 0
          var frameCount = 0
          try {
            gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false })
            if (!gl) throw new Error('no-webgl')
            var compile = function (type, source) {
              var shader = gl.createShader(type)
              gl.shaderSource(shader, source)
              gl.compileShader(shader)
              if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('shader')
              return shader
            }
            program = gl.createProgram()
            gl.attachShader(program, compile(gl.VERTEX_SHADER, GL_VERT))
            gl.attachShader(program, compile(gl.FRAGMENT_SHADER, GL_FRAG))
            gl.linkProgram(program)
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link')
            gl.useProgram(program)
            var buffer = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
            var loc = gl.getAttribLocation(program, 'a')
            gl.enableVertexAttribArray(loc)
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
            var uRes = gl.getUniformLocation(program, 'u_res')
            var uTime = gl.getUniformLocation(program, 'u_time')
            var start = 0
            var reduce =
              window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
            var draw = function (stamp) {
              if (!start) start = stamp
              var ratio = Math.min(window.devicePixelRatio || 1, 2)
              var width = canvas.clientWidth || 1
              var height = canvas.clientHeight || 1
              if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
                canvas.width = Math.round(width * ratio)
                canvas.height = Math.round(height * ratio)
              }
              gl.viewport(0, 0, canvas.width, canvas.height)
              gl.clearColor(0, 0, 0, 0)
              gl.clear(gl.COLOR_BUFFER_BIT)
              gl.uniform2f(uRes, canvas.width, canvas.height)
              gl.uniform1f(uTime, reduce ? 0 : (stamp - start) / 1000)
              gl.drawArrays(gl.TRIANGLES, 0, 3)
              frameCount += 1
              raf = reduce ? 0 : window.requestAnimationFrame(draw)
            }
            raf = window.requestAnimationFrame(draw)
            canvas.style.opacity = '1'
          } catch (error) {
            setFailed(true)
            return undefined
          }
          return function () {
            if (raf) window.cancelAnimationFrame(raf)
            try {
              if (gl && program) gl.deleteProgram(program)
            } catch (error) {
              /* 上下文可能已丢失 */
            }
          }
        },
        [],
      )
      if (failed) return null
      return h('canvas', { className: '__rp_gl', ref: ref, 'aria-hidden': 'true' })
    }

