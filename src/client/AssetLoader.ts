
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
     * Get an asset from the cache synchronously.
     */
    public get(url: string): HTMLImageElement | HTMLAudioElement | undefined {
        return this.cache.get(url);
    }
}
