
import { ClawPlayer } from "/home/ubuntu/clawmotion/src/client/Player";
import { AssetLoader } from "/home/ubuntu/clawmotion/src/client/AssetLoader";
import { ClawEngine } from "/home/ubuntu/clawmotion/src/core/Engine";
import { ClawMath } from "/home/ubuntu/clawmotion/src/core/Math";

(window as any).ClawPlayer = ClawPlayer;
(window as any).ClawEngine = ClawEngine;
(window as any).ClawMath = ClawMath;
(window as any).AssetLoader = AssetLoader;
(window as any).PredefinedBlueprints = {
'neon-vortex.claw': ((ctx) => { const { ctx: c, width, height, time } = ctx; const pulse = 0.5 + 0.5 * Math.sin(time * 2.2); const g = c.createRadialGradient(width * 0.5, height * 0.5, 10, width * 0.5, height * 0.5, Math.max(width, height) * (0.35 + pulse * 0.4)); g.addColorStop(0, '#1e1b4b'); g.addColorStop(0.55, '#7e22ce'); g.addColorStop(1, '#020617'); c.fillStyle = g; c.fillRect(0, 0, width, height); c.globalAlpha = 0.18 + pulse * 0.25; c.fillStyle = '#22d3ee'; for (let i = 0; i < 7; i++) { const r = (time * 120 + i * 80) % (width * 1.1); c.beginPath(); c.arc(width * 0.5, height * 0.5, r, 0, Math.PI * 2); c.strokeStyle = i % 2 ? '#ec4899' : '#22d3ee'; c.lineWidth = 1 + (i % 3); c.stroke(); } c.globalAlpha = 1; }),
'abstract-dancer.claw': ((ctx) => { const { ctx: c, width, height, time } = ctx; const centerX = width * 0.5 + Math.sin(time * 4.3) * width * 0.06; const centerY = height * 0.56 + Math.sin(time * 6.2) * height * 0.025; const beat = 1 + Math.sin(time * 9.2) * 0.12; c.save(); c.translate(centerX, centerY); c.rotate(Math.sin(time * 2.1) * 0.18); c.fillStyle = '#f8fafc'; c.beginPath(); c.ellipse(0, -90 * beat, 56, 74, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#22d3ee'; c.fillRect(-34 * beat, -14, 68 * beat, 148 * beat); c.fillStyle = '#ec4899'; c.fillRect(-126, -2, 92, 16 + Math.sin(time * 10) * 10); c.fillRect(34, -2, 92, 16 + Math.cos(time * 10) * 10); c.fillStyle = '#fde047'; c.fillRect(-52, 140, 40, 90); c.fillRect(12, 140, 40, 90); c.restore(); }),
'beat-waves.claw': ((ctx) => { const { ctx: c, width, height, time } = ctx; const lines = 26; c.globalCompositeOperation = 'screen'; for (let i = 0; i < lines; i++) { const y = (i / lines) * height; const amp = 8 + (i % 5) * 4; c.beginPath(); for (let x = 0; x <= width; x += 18) { const wave = Math.sin(x * 0.02 + time * (2.5 + i * 0.04)) * amp + Math.cos(time * 3 + i) * 3; if (x === 0) c.moveTo(x, y + wave); else c.lineTo(x, y + wave); } c.strokeStyle = i % 2 ? 'rgba(236,72,153,0.22)' : 'rgba(34,211,238,0.22)'; c.lineWidth = 1.2; c.stroke(); } c.globalCompositeOperation = 'source-over'; }),
'hero-title.claw': ((ctx) => { const { ctx: c, width, height, time } = ctx; c.textAlign = 'center'; c.shadowColor = '#ec4899'; c.shadowBlur = 24; c.fillStyle = 'white'; c.font = '700 72px Inter'; c.fillText('ClawMotion', width / 2, height * 0.2 + Math.sin(time * 3) * 8); c.shadowBlur = 0; c.fillStyle = 'rgba(226,232,240,0.88)'; c.font = '500 18px Inter'; c.fillText('Abstract character dancing through the beat', width / 2, height * 0.2 + 34); })
};
