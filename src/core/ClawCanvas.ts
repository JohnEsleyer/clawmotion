const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

export interface ClawContext2D {
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    font: string;
    globalAlpha: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    save(): void;
    restore(): void;
    scale(x: number, y: number): void;
    rotate(angle: number): void;
    translate(x: number, y: number): void;
    beginPath(): void;
    closePath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
    rect(x: number, y: number, w: number, h: number): void;
    fill(): void;
    stroke(): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    strokeRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number, maxWidth?: number): void;
    drawImage(image: any, dx: number, dy: number, dw?: number, dh?: number): void;
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
    clearRect(x: number, y: number, w: number, h: number): void;
    clip(): void;
    setLineDash(segments: number[]): void;
    lineDashOffset: number;
    lineCap: CanvasLineCap;
    lineJoin: CanvasLineJoin;
    miterLimit: number;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
    measureText(text: string): TextMetrics;
    getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
    putImageData(imageData: ImageData, dx: number, dy: number): void;
    globalCompositeOperation: GlobalCompositeOperation;
}

export interface IClawCanvas {
    width: number;
    height: number;
    getContext(type: '2d'): ClawContext2D | null;
    transferToImageBitmap?(): ImageBitmap;
    convertToBuffer?(format: string): Buffer;
}

class BrowserCanvas implements IClawCanvas {
    public width: number;
    public height: number;
    private canvas: OffscreenCanvas | HTMLCanvasElement;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;

        if (typeof OffscreenCanvas !== 'undefined') {
            this.canvas = new OffscreenCanvas(width, height);
        } else {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            this.canvas = canvas;
        }
    }

    getContext(type: '2d'): ClawContext2D | null {
        return this.canvas.getContext('2d') as ClawContext2D | null;
    }

    transferToImageBitmap(): ImageBitmap {
        if (this.canvas instanceof OffscreenCanvas) {
            return this.canvas.transferToImageBitmap();
        } else {
            throw new Error('transferToImageBitmap only supported on OffscreenCanvas');
        }
    }

    get rawCanvas(): OffscreenCanvas | HTMLCanvasElement {
        return this.canvas;
    }
}

class NodeCanvas implements IClawCanvas {
    public width: number;
    public height: number;
    private canvas: any;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.canvas = new (require('skia-canvas').Canvas)(width, height);
    }

    getContext(type: '2d'): ClawContext2D | null {
        return this.canvas.getContext('2d');
    }

    convertToBuffer(format: string): Buffer {
        return this.canvas.toBuffer(format);
    }

    get rawCanvas(): any {
        return this.canvas;
    }
}

export async function createClawCanvas(width: number, height: number): Promise<IClawCanvas> {
    if (isBrowser) {
        return new BrowserCanvas(width, height);
    } else {
        return new NodeCanvas(width, height);
    }
}

export { BrowserCanvas, NodeCanvas };
