
/**
 * AssetLoader handles loading of external resources (Images, Audio).
 */
export class AssetLoader {
    private cache: Map<string, HTMLImageElement | HTMLAudioElement> = new Map();

    /**
     * Load an image from a URL.
     */
    public loadImage(url: string): Promise<HTMLImageElement> {
        if (this.cache.has(url)) {
            return Promise.resolve(this.cache.get(url) as HTMLImageElement);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = url;
            img.onload = () => {
                this.cache.set(url, img);
                resolve(img);
            };
            img.onerror = (err) => reject(new Error(`Failed to load image: ${url} - ${err}`));
        });
    }

    /**
     * Load audio from a URL.
     */
    public loadAudio(url: string): Promise<HTMLAudioElement> {
        if (this.cache.has(url)) {
            return Promise.resolve(this.cache.get(url) as HTMLAudioElement);
        }

        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.crossOrigin = 'Anonymous';
            audio.src = url;
            audio.oncanplaythrough = () => {
                this.cache.set(url, audio);
                resolve(audio);
            };
            audio.onerror = (err) => reject(new Error(`Failed to load audio: ${url} - ${err}`));
        });
    }

    /**
     * Load video from a URL.
     */
    public loadVideo(url: string): Promise<HTMLVideoElement> {
        if (this.cache.has(url)) {
            return Promise.resolve(this.cache.get(url) as HTMLVideoElement);
        }

        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.crossOrigin = 'Anonymous';
            video.src = url;
            video.preload = 'auto';
            video.muted = true; // Required for auto-seeking in some browsers
            video.oncanplaythrough = () => {
                this.cache.set(url, video);
                resolve(video);
            };
            video.onerror = (err) => reject(new Error(`Failed to load video: ${url} - ${err}`));
        });
    }

    /**
     * Get an asset from the cache synchronously.
     */
    public get(url: string): HTMLImageElement | HTMLAudioElement | HTMLVideoElement | undefined {
        return this.cache.get(url) as any;
    }
}
