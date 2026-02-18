
import { ClawPlayer } from './src/client/Player';
import { AssetLoader } from './src/client/AssetLoader';
import { ClawEngine } from './src/core/Engine';
import { ClawMath } from './src/core/Math';
import scene from './examples/hello-world';

(window as any).ClawPlayer = ClawPlayer;
(window as any).ClawEngine = ClawEngine;
(window as any).ClawMath = ClawMath;
(window as any).AssetLoader = AssetLoader;
(window as any).PredefinedBlueprints = scene.blueprints || {};

window.onload = () => {
    const engine = new (window as any).ClawEngine(scene.config);
    // Add clips
    scene.clips.forEach(c => engine.addClip(c));
    if (scene.cameraAnimations) engine.cameraAnimations = scene.cameraAnimations;
    
    // Handle Assets
    const loader = new (window as any).AssetLoader();
    const assetPromises = [];
    if (scene.images) {
        for (const [id, url] of Object.entries(scene.images)) {
             const assetUrl = '/assets/' + url;
             if (url.endsWith('.mp4') || url.endsWith('.webm')) {
                 assetPromises.push(loader.loadVideo(assetUrl).then(v => engine.assets.set(id, v)));
             } else {
                 assetPromises.push(loader.loadImage(assetUrl).then(img => engine.assets.set(id, img)));
             }
        }
    }

    Promise.all(assetPromises).then(() => {
        const player = new (window as any).ClawPlayer('#preview', engine);
        player.play();
        console.log("Preview Ready");
    });
};
