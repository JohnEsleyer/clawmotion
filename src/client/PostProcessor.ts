export class PostProcessor {
    private gl: WebGLRenderingContext;
    private canvas: HTMLCanvasElement;
    private program: WebGLProgram | null = null;
    private texture: WebGLTexture | null = null;

    constructor(width: number, height: number) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        const gl = this.canvas.getContext('webgl');
        if (!gl) throw new Error('WebGL not supported');
        this.gl = gl;
        this.init();
    }

    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    private init() {
        const vs = `
            attribute vec2 position;
            varying vec2 vTexCoord;
            void main() {
                vTexCoord = (position + 1.0) / 2.0;
                vTexCoord.y = 1.0 - vTexCoord.y; // Flip Y for canvas texture
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fs = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform float uTime;
            uniform float uBloom;
            uniform float uChromatic;

            void main() {
                vec2 uv = vTexCoord;
                
                // 1. Chromatic Aberration
                float shift = uChromatic * 0.01;
                float r = texture2D(uSampler, uv + vec2(shift, 0.0)).r;
                float g = texture2D(uSampler, uv).g;
                float b = texture2D(uSampler, uv - vec2(shift, 0.0)).b;
                
                vec4 baseColor = vec4(r, g, b, 1.0);

                // 2. Simple Vignette
                float dist = distance(uv, vec2(0.5));
                float vignette = smoothstep(0.8, 0.4, dist);
                baseColor *= vignette;

                gl_FragColor = baseColor;
            }
        `;

        this.program = this.createProgram(vs, fs);
        this.texture = this.gl.createTexture();
        this.setupQuad();
    }

    private setupQuad() {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]), gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(this.program!, 'position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    }

    public render(source: HTMLCanvasElement, props: any = {}) {
        const gl = this.gl;
        if (!this.program || !this.texture) return;

        gl.useProgram(this.program);

        // Update Texture from source canvas
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        // Uniforms
        const bloomLoc = gl.getUniformLocation(this.program, 'uBloom');
        const chromaticLoc = gl.getUniformLocation(this.program, 'uChromatic');
        gl.uniform1f(bloomLoc, props.bloom || 0);
        gl.uniform1f(chromaticLoc, props.chromatic || 0);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    private createProgram(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        return prog;
    }
}
