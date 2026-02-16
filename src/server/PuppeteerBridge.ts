import puppeteer, { Browser, Page } from 'puppeteer';

export class PuppeteerBridge {
    private browser: Browser | null = null;
    private page: Page | null = null;

    /**
     * Launch the browser and navigate to the preview URL.
     */
    public async launch(url: string, width: number, height: number): Promise<any> {
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width, height });

        // Enable console log piping from browser to node
        this.page.on('console', msg => console.log('BROWSER:', msg.text()));

        return await this.page.goto(url, { waitUntil: 'networkidle0' });
    }

    /**
     * Seek the player on the page to a specific tick.
     * Assumes window.player is exposed.
     */
    public async seekToTick(tick: number, state?: any) {
        if (!this.page) throw new Error('Page not initialized');

        await this.page.evaluate(async (t, s) => {
            // @ts-ignore
            if (window.player) {
                // @ts-ignore
                if (s) {
                    // @ts-ignore
                    Object.assign(window.player.engine.config, s);
                }
                // @ts-ignore
                await window.player.seek(t);
            } else {
                throw new Error('Player not found on window');
            }
        }, tick, state);
    }

    /**
     * Capture the current frame as a buffer.
     */
    public async captureFrame(): Promise<Buffer> {
        if (!this.page) throw new Error('Page not initialized');
        // Uint8Array is compatible with Buffer in Node environment for this purpose
        return Buffer.from(await this.page.screenshot({ type: 'jpeg', quality: 90 }));
    }

    public async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}
