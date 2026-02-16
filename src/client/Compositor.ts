export interface LayerData {
    source: HTMLCanvasElement;
    opacity: number;
    blendMode: string;
    transform: {
        translateX: number;
        translateY: number;
        scale: number;
    };
}

export class Compositor {
    private gl: WebGLRenderingContext;
    private canvas: HTMLCanvasElement;
    private mainProgram: WebGLProgram | null = null;
    private quadBuffer: WebGLBuffer | null = null;

    constructor(width: number, height: number) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        const gl = this.canvas.getContext('webgl', { alpha: true });
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
            uniform vec2 uTranslation;
            uniform float uScale;
            uniform vec2 uResolution;

            void main() {
                // Apply transform in normalized device coordinates
                // We assume source is full-canvas sized
                vec2 pos = position;
                pos *= uScale;
                pos += (uTranslation / uResolution) * 2.0;

                vTexCoord = (position + 1.0) / 2.0;
                vTexCoord.y = 1.0 - vTexCoord.y; 
                gl_Position = vec4(pos, 0.0, 1.0);
            }
        `;

        const fs = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uSampler;
            uniform float uOpacity;
            uniform int uBlendMode;

            void main() {
                vec4 tex = texture2D(uSampler, vTexCoord);
                if (vTexCoord.x < 0.0 || vTexCoord.x > 1.0 || vTexCoord.y < 0.0 || vTexCoord.y > 1.0) {
                    discard;
                }
                gl_FragColor = tex * uOpacity;
            }
        `;

        this.mainProgram = this.createProgram(vs, fs);
        this.setupQuad();
    }

    private setupQuad() {
        const gl = this.gl;
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]), gl.STATIC_DRAW);
    }

    public composite(layers: LayerData[]) {
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);

        for (const layer of layers) {
            this.renderLayer(layer);
        }

        gl.disable(gl.BLEND);
    }

    private renderLayer(layer: LayerData) {
        const gl = this.gl;
        if (!this.mainProgram) return;

        gl.useProgram(this.mainProgram);

        // Blending Mode mapping
        if (layer.blendMode === 'multiply') {
            gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
        } else if (layer.blendMode === 'screen') {
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        } else if (layer.blendMode === 'add') {
            gl.blendFunc(gl.ONE, gl.ONE);
        } else if (layer.blendMode === 'overlay') {
            // Overlay is hard to do with standard blendFunc, 
            // usually requires a backbuffer texture and a custom shader.
            // For now, we'll approximate with Multi-pass or just default to normal
            // if we don't want to get too complex yet.
            // Actually, let's stick to standard modes for reliability.
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        } else {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer.source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        const posLoc = gl.getAttribLocation(this.mainProgram, 'position');
        gl.enableVertexAttribArray(posLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.uniform1f(gl.getUniformLocation(this.mainProgram, 'uOpacity'), layer.opacity);
        gl.uniform1f(gl.getUniformLocation(this.mainProgram, 'uScale'), layer.transform.scale);
        gl.uniform2f(gl.getUniformLocation(this.mainProgram, 'uTranslation'), layer.transform.translateX, -layer.transform.translateY); // Flip Y for GL
        gl.uniform2f(gl.getUniformLocation(this.mainProgram, 'uResolution'), this.canvas.width, this.canvas.height);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.deleteTexture(texture);
    }

    private createProgram(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(vs));
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(fs));
        }

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        return prog;
    }
}
