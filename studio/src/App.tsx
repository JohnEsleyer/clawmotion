import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Plus, Trash2, Download, Code, FileJson, Edit2, X,
  RefreshCw, ZoomIn, ZoomOut, Copy, GripVertical, GripHorizontal, Sparkles, FolderOpen,
  Image as ImageIcon, Music, Video
} from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';

if (typeof window !== 'undefined') {
  (window as any).Prism = Prism;
}
import 'prismjs/components/prism-typescript';

import { StudioEngine, analyzeAudioFile, detectBeats, generateAudioSummary } from './services/engine';
import { generateClawCode, PUTER_MODELS } from './services/geminiService';
import { ChatMessage, Asset, FileEntry, AudioMetadata, AudioAnalysisSettings, AudioSection, TimelineSegment } from './types';
import { FULL_COMPREHENSIVE_GUIDE } from './constants';

const SCREEN_SIZES = [
  { id: '16:9', label: 'YouTube / Desktop', width: 1280, height: 720 },
  { id: '9:16', label: 'TikTok / Shorts', width: 720, height: 1280 },
  { id: '1:1', label: 'Instagram / Square', width: 1080, height: 1080 },
  { id: '4:3', label: 'Classic / Tablet', width: 1024, height: 768 },
];

const SEGMENT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];
const TIMELINE_MIN_WIDTH = 900;
const TIMELINE_LEFT_PAD = 20;
const MIN_CLIP_DURATION = 0.12;

type TimelineClipUI = {
  id: string;
  clipIndex: number;
  blueprintId: string;
  label: string;
  start: number;
  end: number;
  color: string;
};

type TimelineDragTarget = {
  kind: 'segment' | 'clip' | 'playhead';
  id: string;
  action: 'move' | 'resize-start' | 'resize-end';
  originClientX: number;
  originStart: number;
  originEnd: number;
};

const ClawLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
    <path d="M14 8c-1.1-1.1-1.4-2.6-1-4-2 .5-4 2-5 4-3 5-2 11 2 12" />
    <path d="M20 10c-1-2-3-3-5-3" />
    <path d="M6 10c-1.5 2-2 5-1 8s4 4 8 2" />
    <circle cx="12" cy="12" r="2" className="fill-red-500 stroke-none" />
  </svg>
);

const AudioAnalysisModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSave: (id: string, metadata: AudioMetadata) => void;
}> = ({ isOpen, onClose, asset, onSave }) => {
  if (!isOpen || !asset || !asset.metadata) return null;

  const [settings, setSettings] = useState<AudioAnalysisSettings>(asset.metadata.settings);
  const [beats, setBeats] = useState<number[]>(asset.metadata.beats);
  const [sections, setSections] = useState<AudioSection[]>(asset.metadata.sections || []);

  useEffect(() => {
    if (asset.metadata?.energies) {
      setBeats(detectBeats(asset.metadata.energies, settings));
    }
  }, [asset, settings]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-8">
      <div className="bg-[#0f0f1a] border border-slate-700 w-full max-w-2xl rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">Audio Analysis: {asset.name}</h2>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs">Threshold
            <input type="number" step="0.05" value={settings.threshold} onChange={(e) => setSettings({ ...settings, threshold: Number(e.target.value) })} className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2" />
          </label>
          <label className="text-xs">Min Interval
            <input type="number" step="0.05" value={settings.minInterval} onChange={(e) => setSettings({ ...settings, minInterval: Number(e.target.value) })} className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2" />
          </label>
          <label className="text-xs">Offset
            <input type="number" step="0.05" value={settings.offset} onChange={(e) => setSettings({ ...settings, offset: Number(e.target.value) })} className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2" />
          </label>
        </div>
        <div className="text-xs text-slate-400">Detected beats: {beats.length} · Sections: {sections.length}</div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs">Cancel</button>
          <button onClick={() => {
            const metadata: AudioMetadata = {
              ...asset.metadata!,
              beats,
              sections,
              settings,
              summary: generateAudioSummary(asset.metadata!.duration, beats, sections)
            };
            onSave(asset.id, metadata);
            onClose();
          }} className="px-4 py-2 text-xs rounded bg-emerald-600">Save</button>
        </div>
      </div>
    </div>
  );
};

const SegmentModal: React.FC<{
  segment: TimelineSegment | null;
  duration: number;
  onClose: () => void;
  onSave: (segment: TimelineSegment) => void;
  onDelete: (id: string) => void;
}> = ({ segment, duration, onClose, onSave, onDelete }) => {
  if (!segment) return null;

  return (
    <div className="fixed inset-0 z-[190] bg-black/80 p-8 flex items-center justify-center">
      <div className="bg-[#0f0f1a] border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Edit Segment</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <input value={segment.name} onChange={(e) => onSave({ ...segment, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" />
          <textarea value={segment.description} onChange={(e) => onSave({ ...segment, description: e.target.value })} className="w-full h-40 bg-slate-900 border border-slate-700 rounded p-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">Start
              <input type="number" step="0.1" value={segment.start} onChange={(e) => onSave({ ...segment, start: Math.max(0, Number(e.target.value)) })} className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2" />
            </label>
            <label className="text-xs">End
              <input type="number" step="0.1" value={segment.end} onChange={(e) => onSave({ ...segment, end: Math.min(duration, Number(e.target.value)) })} className="w-full mt-1 bg-slate-900 border border-slate-700 rounded p-2" />
            </label>
          </div>
        </div>
        <div className="flex justify-between pt-2">
          <button onClick={() => { onDelete(segment.id); onClose(); }} className="px-4 py-2 rounded bg-red-700 text-xs">Delete</button>
          <button onClick={onClose} className="px-4 py-2 rounded bg-slate-800 text-xs">Done</button>
        </div>
      </div>
    </div>
  );
};

const ExportProgressModal: React.FC<{ isOpen: boolean; progress: number; done: boolean; onClose: () => void; }> = ({ isOpen, progress, done, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[220] bg-black/85 p-8 flex items-center justify-center">
      <div className="bg-[#0f0f1a] border border-slate-700 rounded-2xl w-full max-w-xl p-6 space-y-4">
        <h3 className="font-bold">Server Rendering Export</h3>
        <p className="text-xs text-slate-400">Preparing and rendering your timeline on the server.</p>
        <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div className="h-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-xs font-mono text-right">{progress}%</div>
        <div className="flex justify-end">
          <button onClick={onClose} disabled={!done} className="px-4 py-2 text-xs rounded bg-red-600 disabled:opacity-40">{done ? 'Close' : 'Rendering...'}</button>
        </div>
      </div>
    </div>
  );
};

const buildDefaultFiles = (): FileEntry[] => ([
  {
    id: 'orch',
    name: 'orchestrator.ts',
    type: 'orchestrator',
    code: `claw.setDuration(12);

claw.addClip({
  id: 'pulse-vortex',
  blueprintId: 'neon-vortex.claw',
  startTick: claw.toTicks(0),
  durationTicks: claw.toTicks(12),
  layer: 0,
  props: { palette: ['#020617', '#6d28d9', '#ec4899', '#22d3ee'] },
  entry: { type: 'fade', durationTicks: claw.toTicks(0.2) },
  exit: { type: 'fade', durationTicks: claw.toTicks(0.2) }
});

claw.addClip({
  id: 'dancer-body',
  blueprintId: 'abstract-dancer.claw',
  startTick: claw.toTicks(0.5),
  durationTicks: claw.toTicks(11.2),
  layer: 20,
  entry: { type: 'zoom', durationTicks: claw.toTicks(0.45) },
  exit: { type: 'zoom', durationTicks: claw.toTicks(0.65) }
});

claw.addClip({
  id: 'beat-waves',
  blueprintId: 'beat-waves.claw',
  startTick: claw.toTicks(0),
  durationTicks: claw.toTicks(12),
  layer: 10,
  entry: { type: 'slide', durationTicks: claw.toTicks(0.35) },
  exit: { type: 'fade', durationTicks: claw.toTicks(0.35) }
});

claw.addClip({
  id: 'brand-tag',
  blueprintId: 'hero-title.claw',
  startTick: claw.toTicks(1.1),
  durationTicks: claw.toTicks(9.9),
  layer: 30,
  props: { title: 'ClawMotion' },
  entry: { type: 'slide', durationTicks: claw.toTicks(0.6) },
  exit: { type: 'glitch', durationTicks: claw.toTicks(0.8) }
});`
  },
  { id: 'neon-vortex', name: 'neon-vortex.claw', type: 'clip', code: `(ctx) => { const { ctx: c, width, height, time } = ctx; const pulse = 0.5 + 0.5 * Math.sin(time * 2.2); const g = c.createRadialGradient(width * 0.5, height * 0.5, 10, width * 0.5, height * 0.5, Math.max(width, height) * (0.35 + pulse * 0.4)); g.addColorStop(0, '#1e1b4b'); g.addColorStop(0.55, '#7e22ce'); g.addColorStop(1, '#020617'); c.fillStyle = g; c.fillRect(0, 0, width, height); c.globalAlpha = 0.18 + pulse * 0.25; c.fillStyle = '#22d3ee'; for (let i = 0; i < 7; i++) { const r = (time * 120 + i * 80) % (width * 1.1); c.beginPath(); c.arc(width * 0.5, height * 0.5, r, 0, Math.PI * 2); c.strokeStyle = i % 2 ? '#ec4899' : '#22d3ee'; c.lineWidth = 1 + (i % 3); c.stroke(); } c.globalAlpha = 1; }` },
  { id: 'abstract-dancer', name: 'abstract-dancer.claw', type: 'clip', code: `(ctx) => { const { ctx: c, width, height, time } = ctx; const centerX = width * 0.5 + Math.sin(time * 4.3) * width * 0.06; const centerY = height * 0.56 + Math.sin(time * 6.2) * height * 0.025; const beat = 1 + Math.sin(time * 9.2) * 0.12; c.save(); c.translate(centerX, centerY); c.rotate(Math.sin(time * 2.1) * 0.18); c.fillStyle = '#f8fafc'; c.beginPath(); c.ellipse(0, -90 * beat, 56, 74, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#22d3ee'; c.fillRect(-34 * beat, -14, 68 * beat, 148 * beat); c.fillStyle = '#ec4899'; c.fillRect(-126, -2, 92, 16 + Math.sin(time * 10) * 10); c.fillRect(34, -2, 92, 16 + Math.cos(time * 10) * 10); c.fillStyle = '#fde047'; c.fillRect(-52, 140, 40, 90); c.fillRect(12, 140, 40, 90); c.restore(); }` },
  { id: 'beat-waves', name: 'beat-waves.claw', type: 'clip', code: `(ctx) => { const { ctx: c, width, height, time } = ctx; const lines = 26; c.globalCompositeOperation = 'screen'; for (let i = 0; i < lines; i++) { const y = (i / lines) * height; const amp = 8 + (i % 5) * 4; c.beginPath(); for (let x = 0; x <= width; x += 18) { const wave = Math.sin(x * 0.02 + time * (2.5 + i * 0.04)) * amp + Math.cos(time * 3 + i) * 3; if (x === 0) c.moveTo(x, y + wave); else c.lineTo(x, y + wave); } c.strokeStyle = i % 2 ? 'rgba(236,72,153,0.22)' : 'rgba(34,211,238,0.22)'; c.lineWidth = 1.2; c.stroke(); } c.globalCompositeOperation = 'source-over'; }` },
  { id: 'hero-title', name: 'hero-title.claw', type: 'clip', code: `(ctx) => { const { ctx: c, width, height, time } = ctx; c.textAlign = 'center'; c.shadowColor = '#ec4899'; c.shadowBlur = 24; c.fillStyle = 'white'; c.font = '700 72px Inter'; c.fillText('ClawMotion', width / 2, height * 0.2 + Math.sin(time * 3) * 8); c.shadowBlur = 0; c.fillStyle = 'rgba(226,232,240,0.88)'; c.font = '500 18px Inter'; c.fillText('Abstract character dancing through the beat', width / 2, height * 0.2 + 34); }` }
]);

const App: React.FC = () => {
  const [duration, setDuration] = useState(12);
  const [selectedSize, setSelectedSize] = useState(SCREEN_SIZES[0]);
  const [files, setFiles] = useState<FileEntry[]>(buildDefaultFiles());
  const [activeFileId, setActiveFileId] = useState('orch');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analyzingAsset, setAnalyzingAsset] = useState<Asset | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [timelineScale, setTimelineScale] = useState(1);
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [rightPanelWidth, setRightPanelWidth] = useState(430);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(250);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | 'bottom' | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Welcome to ClawStudio. Describe what you want to build.', timestamp: Date.now() }]);
  const [chatInput, setChatInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<(typeof PUTER_MODELS)[number]>(PUTER_MODELS[0]);
  const [activeTab, setActiveTab] = useState<'helper' | 'code'>('helper');
  const [leftTab, setLeftTab] = useState<'explorer' | 'assets'>('explorer');
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<TimelineSegment[]>([
    { id: 'seg-1', name: 'Ignition', description: 'Neon vortex opens with pulsing rings and camera snap.', start: 0, end: 3.2, color: SEGMENT_COLORS[0] },
    { id: 'seg-2', name: 'Dance Core', description: 'Abstract character hits the beat with shape-driven choreography.', start: 3.2, end: 8.6, color: SEGMENT_COLORS[2] },
    { id: 'seg-3', name: 'Final Drop', description: 'Glitch transition and branded finish on the final downbeat.', start: 8.6, end: 12, color: SEGMENT_COLORS[4] }
  ]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [clipOverrides, setClipOverrides] = useState<Record<string, { start: number; end: number }>>({});
  const [dragTarget, setDragTarget] = useState<TimelineDragTarget | null>(null);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const studioEngineRef = useRef<StudioEngine | null>(null);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;

  const fileRename = (id: string, name: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  };

  const createFile = () => {
    const base = `new-clip-${files.filter((f) => f.type === 'clip').length + 1}.claw`;
    const newFile: FileEntry = {
      id: `f-${Date.now()}`,
      name: base,
      type: 'clip',
      code: `(ctx) => {\n  const { ctx: c, width, height } = ctx;\n  c.fillStyle = '#111827';\n  c.fillRect(0, 0, width, height);\n}`
    };
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setActiveTab('code');
  };

  const deleteFile = (id: string) => {
    const target = files.find((f) => f.id === id);
    if (!target || target.type === 'orchestrator') return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeFileId === id) setActiveFileId('orch');
  };

  const rebuildEngine = useCallback(() => {
    if (!playerContainerRef.current) return;
    playerContainerRef.current.innerHTML = '';

    const engine = new StudioEngine({ width: selectedSize.width, height: selectedSize.height, fps: 30, duration }, playerContainerRef.current);
    studioEngineRef.current = engine;

    try {
      files.filter((f) => f.type === 'clip').forEach((f) => {
        const drawFn = eval(f.code);
        engine.registerBlueprint(f.name, drawFn);
      });
      const orch = files.find((f) => f.type === 'orchestrator');
      if (orch) {
        const runOrch = new Function('claw', orch.code);
        runOrch(engine);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Unknown engine build error');
    }
  }, [files, selectedSize, duration]);

  useEffect(() => {
    rebuildEngine();
  }, [rebuildEngine]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && studioEngineRef.current) {
        const t = studioEngineRef.current.getCurrentTime();
        setCurrentTime(Math.min(duration, t));
      }
    }, 33);
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing) return;
      if (isResizing === 'left') setLeftPanelWidth(Math.max(220, Math.min(540, e.clientX)));
      if (isResizing === 'right') setRightPanelWidth(Math.max(300, Math.min(700, window.innerWidth - e.clientX)));
      if (isResizing === 'bottom') setBottomPanelHeight(Math.max(180, Math.min(500, window.innerHeight - e.clientY)));
    };
    const onUp = () => setIsResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  const togglePlay = () => {
    if (!studioEngineRef.current) return;
    if (isPlaying) studioEngineRef.current.pause();
    else studioEngineRef.current.play();
    setIsPlaying((v) => !v);
  };

  const seekTime = async (time: number) => {
    const t = Math.max(0, Math.min(duration, time));
    setCurrentTime(t);
    if (studioEngineRef.current) await studioEngineRef.current.seek(t);
  };

  const timelineTotalWidth = Math.max(TIMELINE_MIN_WIDTH, Math.round(1400 * timelineScale));
  const timelineUsableWidth = Math.max(1, timelineTotalWidth - TIMELINE_LEFT_PAD * 2);

  const secondsToX = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(duration, seconds));
    return TIMELINE_LEFT_PAD + (clamped / duration) * timelineUsableWidth;
  }, [duration, timelineUsableWidth]);

  const xToSeconds = useCallback((x: number) => {
    const normalized = Math.max(0, Math.min(timelineUsableWidth, x - TIMELINE_LEFT_PAD));
    return (normalized / timelineUsableWidth) * duration;
  }, [duration, timelineUsableWidth]);

  const seekFromClientX = useCallback((clientX: number) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const localX = clientX - rect.left + timelineRef.current.scrollLeft;
    seekTime(xToSeconds(localX));
  }, [xToSeconds]);

  const clips = studioEngineRef.current?.getState().clips || [];

  const timelineClips: TimelineClipUI[] = clips.map((clip: any, idx: number) => {
    const clipId = clip.id || `clip-${idx}-${clip.blueprintId}`;
    const baseStart = clip.startTick / 30;
    const baseEnd = (clip.startTick + clip.durationTicks) / 30;
    const override = clipOverrides[clipId];
    return {
      id: clipId,
      clipIndex: idx,
      blueprintId: clip.blueprintId,
      label: clip.id || clip.blueprintId,
      start: override?.start ?? baseStart,
      end: override?.end ?? baseEnd,
      color: `hsl(${(idx * 47) % 360} 80% 55%)`
    };
  });

  useEffect(() => {
    const onDragMove = (e: MouseEvent) => {
      if (!dragTarget) return;
      e.preventDefault();
      if (!timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const nextTime = xToSeconds(localX);
      const delta = nextTime - xToSeconds(dragTarget.originClientX - rect.left + timelineRef.current.scrollLeft);

      if (dragTarget.kind === 'playhead') {
        seekFromClientX(e.clientX);
        return;
      }

      if (dragTarget.kind === 'segment') {
        setSegments((prev) => prev.map((segment) => {
          if (segment.id !== dragTarget.id) return segment;
          if (dragTarget.action === 'move') {
            const span = dragTarget.originEnd - dragTarget.originStart;
            const start = Math.max(0, Math.min(duration - span, dragTarget.originStart + delta));
            return { ...segment, start, end: start + span };
          }
          if (dragTarget.action === 'resize-start') {
            const start = Math.max(0, Math.min(dragTarget.originEnd - MIN_CLIP_DURATION, dragTarget.originStart + delta));
            return { ...segment, start };
          }
          const end = Math.min(duration, Math.max(dragTarget.originStart + MIN_CLIP_DURATION, dragTarget.originEnd + delta));
          return { ...segment, end };
        }));
      } else {
        setClipOverrides((prev) => {
          const current = prev[dragTarget.id] ?? { start: dragTarget.originStart, end: dragTarget.originEnd };
          let start = current.start;
          let end = current.end;
          if (dragTarget.action === 'move') {
            const span = dragTarget.originEnd - dragTarget.originStart;
            start = Math.max(0, Math.min(duration - span, dragTarget.originStart + delta));
            end = start + span;
          } else if (dragTarget.action === 'resize-start') {
            start = Math.max(0, Math.min(dragTarget.originEnd - MIN_CLIP_DURATION, dragTarget.originStart + delta));
          } else {
            end = Math.min(duration, Math.max(dragTarget.originStart + MIN_CLIP_DURATION, dragTarget.originEnd + delta));
          }
          return { ...prev, [dragTarget.id]: { start, end } };
        });
      }
      seekFromClientX(e.clientX);
    };

    const onDragUp = () => setDragTarget(null);

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragUp);
    return () => {
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragUp);
    };
  }, [dragTarget, duration, seekFromClientX, xToSeconds]);

  useEffect(() => {
    if (!studioEngineRef.current) return;
    const engineClips = studioEngineRef.current.getState().clips;
    let changed = false;
    engineClips.forEach((clip: any, idx: number) => {
      const clipId = clip.id || `clip-${idx}-${clip.blueprintId}`;
      const override = clipOverrides[clipId];
      if (!override) return;
      const startTick = Math.round(override.start * 30);
      const durationTicks = Math.max(1, Math.round((override.end - override.start) * 30));
      if (clip.startTick !== startTick || clip.durationTicks !== durationTicks) {
        clip.startTick = startTick;
        clip.durationTicks = durationTicks;
        changed = true;
      }
    });
    if (changed) {
      void seekTime(currentTime);
    }
  }, [clipOverrides, currentTime]);

  const startDrag = (drag: Omit<TimelineDragTarget, 'originClientX'>, clientX: number) => {
    setDragTarget({ ...drag, originClientX: clientX });
  };

  const handleTimelinePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    seekFromClientX(e.clientX);
    startDrag({ kind: 'playhead', id: '__playhead__', action: 'move', originStart: currentTime, originEnd: currentTime }, e.clientX);
  };

  const rulerMarks = (() => {
    const marks: Array<{ time: number; major: boolean }> = [];
    const minorStep = duration <= 8 ? 0.1 : duration <= 30 ? 0.25 : 0.5;
    const total = Math.floor(duration / minorStep);
    for (let i = 0; i <= total; i++) {
      const time = i * minorStep;
      marks.push({ time, major: Math.abs(time - Math.round(time)) < 0.0001 });
    }
    return marks;
  })();

  const buildFullContext = () => {
    const clipSummaries = clips.map((c: any) => `${c.id || c.blueprintId}: ${c.blueprintId} [${(c.startTick / 30).toFixed(2)}s - ${((c.startTick + c.durationTicks) / 30).toFixed(2)}s]`).join('\n');
    const segmentSummary = segments.map((s) => `- ${s.name} (${s.start.toFixed(2)}-${s.end.toFixed(2)}): ${s.description}`).join('\n');

    return `# Studio Context\n\n${FULL_COMPREHENSIVE_GUIDE}\n\n## Timeline Segments\n${segmentSummary}\n\n## Active Clips\n${clipSummaries || 'none'}\n\n## Files\n${files.map((f) => `- ${f.name} (${f.type})`).join('\n')}\n\n## Imported Assets (full context to use in generation)\n${assets.map((a) => `- ${a.name} [${a.id}] (${a.type}) url=${a.url} ${a.metadata ? `[${a.metadata.summary}]` : ''}`).join('\n') || 'none'}\n\n## Current File (${activeFile.name})\n\n\`\`\`typescript\n${activeFile.code}\n\`\`\``;
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: chatInput, timestamp: Date.now() }]);
    const prompt = `${chatInput}\n\n${buildFullContext()}`;
    setChatInput('');
    try {
      const result = await generateClawCode(prompt, files, assets, selectedModel);
      setMessages((prev) => [...prev, { role: 'assistant', content: result, timestamp: Date.now() }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to process request.', timestamp: Date.now() }]);
    }
  };

  const handleImportAssets = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    const newAssets: Asset[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
      const asset: Asset = { id: `asset-${Date.now()}-${i}`, name: file.name, type, url: URL.createObjectURL(file) };
      if (type === 'audio') {
        try {
          asset.metadata = await analyzeAudioFile(file);
        } catch {
          // ignore
        }
      }
      newAssets.push(asset);
    }
    setAssets((prev) => [...prev, ...newAssets]);
    e.target.value = '';
  };

  const addSegment = () => {
    const idx = segments.length % SEGMENT_COLORS.length;
    const seg: TimelineSegment = {
      id: `seg-${Date.now()}`,
      name: `Segment ${segments.length + 1}`,
      description: 'Describe desired flow for this segment.',
      start: Math.max(0, currentTime),
      end: Math.min(duration, currentTime + 2),
      color: SEGMENT_COLORS[idx]
    };
    setSegments((prev) => [...prev, seg]);
    setSelectedSegmentId(seg.id);
  };

  const handleExport = () => {
    setShowExportModal(true);
    setExportProgress(3);
  };

  useEffect(() => {
    if (!showExportModal) return;
    if (exportProgress >= 100) return;
    const t = setTimeout(() => setExportProgress((prev) => Math.min(100, prev + Math.max(3, Math.round((100 - prev) * 0.18)))), 350);
    return () => clearTimeout(t);
  }, [showExportModal, exportProgress]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0a0f] text-slate-200">
      <header className="flex items-center justify-between px-4 py-2 bg-[#0f0f1a] border-b border-red-900/30 shrink-0 z-50 gap-3">
        <div className="flex items-center gap-3">
          <ClawLogo />
          <span className="font-bold tracking-tighter text-lg">clawmotion</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select value={selectedSize.id} onChange={(e) => setSelectedSize(SCREEN_SIZES.find((s) => s.id === e.target.value)!)} className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1">
            {SCREEN_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <label className="text-xs rounded px-2 py-1 border border-slate-700 bg-slate-900">Duration
            <input type="number" value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} className="w-12 ml-2 bg-transparent outline-none" />
          </label>
          <button onClick={rebuildEngine} className="px-3 py-1.5 text-xs rounded bg-slate-800"><RefreshCw className="w-3 h-3 inline mr-1" />Rebuild</button>
          <button onClick={() => navigator.clipboard.writeText(buildFullContext())} className="px-3 py-1.5 text-xs rounded bg-slate-800"><Copy className="w-3 h-3 inline mr-1" />Copy Context</button>
          <button onClick={handleExport} className="px-3 py-1.5 text-xs rounded bg-red-600"><Download className="w-3 h-3 inline mr-1" />Export</button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex relative">
        <aside style={{ width: leftPanelWidth }} className="bg-[#0f0f1a] border-r border-slate-800/50 flex flex-col shrink-0">
          <div className="flex border-b border-slate-800/50">
            <button onClick={() => setLeftTab('explorer')} className={`flex-1 py-2 text-[10px] uppercase font-black ${leftTab === 'explorer' ? 'text-red-400 border-b-2 border-red-500' : 'text-slate-500'}`}>Explorer</button>
            <button onClick={() => setLeftTab('assets')} className={`flex-1 py-2 text-[10px] uppercase font-black ${leftTab === 'assets' ? 'text-red-400 border-b-2 border-red-500' : 'text-slate-500'}`}>Assets</button>
          </div>

          {leftTab === 'explorer' ? (
            <>
              <div className="p-3 border-b border-slate-800/50 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Files</h2>
                <button onClick={createFile} className="p-1 hover:bg-slate-800 rounded text-red-400"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {files.map((f) => (
                  <div key={f.id} className={`group flex items-center gap-2 px-2 py-2 rounded ${activeFileId === f.id ? 'bg-red-900/20 ring-1 ring-red-500/30' : 'hover:bg-slate-800/40'}`}>
                    <button className="flex-1 flex items-center gap-2 min-w-0" onClick={() => { setActiveFileId(f.id); setActiveTab('code'); }}>
                      {f.type === 'orchestrator' ? <FileJson className="w-4 h-4 text-amber-500" /> : <Code className="w-4 h-4 text-red-400" />}
                      <span className="text-xs truncate">{f.name}</span>
                    </button>
                    <button onClick={() => {
                      const name = prompt('Rename file', f.name);
                      if (!name) return;
                      fileRename(f.id, name);
                    }} className="opacity-0 group-hover:opacity-100"><Edit2 className="w-3 h-3" /></button>
                    {f.type !== 'orchestrator' && <button onClick={() => deleteFile(f.id)} className="opacity-0 group-hover:opacity-100 text-red-400"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col min-h-0">
              <div className="p-3 border-b border-slate-800/50 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Library</h2>
                <label className="px-2 py-1 text-xs rounded bg-red-600 cursor-pointer"><FolderOpen className="w-3 h-3 inline mr-1" />Upload
                  <input ref={assetInputRef} type="file" multiple className="hidden" accept="image/*,video/*,audio/*" onChange={handleImportAssets} />
                </label>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {assets.length === 0 && <div className="text-xs text-slate-500 p-2">No assets imported yet.</div>}
                {assets.map((a) => (
                  <div key={a.id} className="rounded border border-slate-800 bg-slate-900/40 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs truncate">{a.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                          {a.type === 'image' && <ImageIcon className="w-3 h-3" />}
                          {a.type === 'video' && <Video className="w-3 h-3" />}
                          {a.type === 'audio' && <Music className="w-3 h-3" />}
                          {a.type}
                        </div>
                      </div>
                      <button onClick={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))} className="text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    {a.type === 'audio' && <button onClick={() => { setAnalyzingAsset(a); setShowAnalysisModal(true); }} className="mt-2 w-full text-[10px] py-1 rounded bg-emerald-700">Analyze Audio</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
        <div className="w-1 cursor-col-resize bg-slate-900 hover:bg-red-500/60" onMouseDown={() => setIsResizing('left')}><GripVertical className="w-3 h-3 mx-auto mt-4 text-slate-500" /></div>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 bg-[#050505] relative p-4">
            <button onClick={togglePlay} className="w-full h-full border border-zinc-800 bg-black rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.7)] flex items-center justify-center p-4">
              <div className="relative w-full h-full flex items-center justify-center">
                <div ref={playerContainerRef} className="relative border border-slate-800/40 bg-black rounded-lg overflow-hidden flex items-center justify-center max-w-full max-h-full" style={{ aspectRatio: `${selectedSize.width}/${selectedSize.height}`, width: '100%', height: '100%' }} />
                {!isPlaying && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="rounded-full bg-black/60 border border-slate-600 p-4"><Play className="w-8 h-8 text-red-400" /></div></div>}
              </div>
            </button>
            {error && <div className="absolute inset-0 flex items-center justify-center"><div className="bg-red-900/80 border border-red-500 p-4 rounded text-xs">{error}</div></div>}
          </div>

          <div className="h-1 cursor-row-resize bg-slate-900 hover:bg-red-500/60" onMouseDown={() => setIsResizing('bottom')}><GripHorizontal className="w-3 h-3 mx-auto text-slate-500" /></div>

          <footer style={{ height: bottomPanelHeight }} className="bg-[#0f0f1a] border-t border-slate-800 flex flex-col shrink-0">
            <div className="h-10 border-b border-slate-800 px-3 flex items-center gap-3 text-xs">
              <button onClick={togglePlay}>{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
              <span className="font-mono">{currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
              <button onClick={() => setTimelineScale((z) => Math.max(0.5, z - 0.2))}><ZoomOut className="w-4 h-4" /></button>
              <span>{Math.round(timelineScale * 100)}%</span>
              <button onClick={() => setTimelineScale((z) => Math.min(8, z + 0.2))}><ZoomIn className="w-4 h-4" /></button>
              <button onClick={addSegment} className="ml-2 px-2 py-1 rounded bg-slate-800 text-[10px]"><Plus className="w-3 h-3 inline mr-1" />Segment</button>
            </div>
            <div ref={timelineRef} onMouseDown={handleTimelinePointerDown} className="flex-1 relative overflow-x-auto custom-scrollbar cursor-pointer">
              <div className="h-full p-2" style={{ width: timelineTotalWidth }}>
                <div className="text-[10px] uppercase font-black text-slate-500 mb-1">Timeline</div>

                <div className="h-9 rounded border border-slate-800 bg-slate-900/30 relative mb-2 overflow-hidden">
                  {rulerMarks.map((mark) => (
                    <div key={`r-${mark.time.toFixed(3)}`} className="absolute top-0 bottom-0" style={{ left: `${secondsToX(mark.time)}px` }}>
                      <div className={`w-px ${mark.major ? 'h-5 bg-slate-300' : 'h-3 bg-slate-600'}`} />
                      {mark.major && <div className="text-[9px] mt-0.5 -translate-x-1/2 text-slate-300">{mark.time.toFixed(0)}s / {(mark.time * 1000).toFixed(0)}ms</div>}
                    </div>
                  ))}
                </div>

                <div className="h-12 rounded border border-slate-800 bg-slate-900/30 relative mb-2 overflow-hidden">
                  {segments.map((s) => {
                    const left = secondsToX(s.start);
                    const width = Math.max(8, secondsToX(s.end) - secondsToX(s.start));
                    return (
                      <button
                        key={s.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedSegmentId(s.id); }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startDrag({ kind: 'segment', id: s.id, action: 'move', originStart: s.start, originEnd: s.end }, e.clientX);
                        }}
                        className="absolute top-0 bottom-0 border-r border-black/30 text-left px-2"
                        style={{ left, width, background: `${s.color}66` }}
                        title={`${s.name}: ${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s`}
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            startDrag({ kind: 'segment', id: s.id, action: 'resize-start', originStart: s.start, originEnd: s.end }, e.clientX);
                          }}
                        />
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            startDrag({ kind: 'segment', id: s.id, action: 'resize-end', originStart: s.start, originEnd: s.end }, e.clientX);
                          }}
                        />
                        <div className="text-[10px] font-semibold truncate">{s.name}</div>
                        <div className="text-[9px] opacity-80 truncate">{s.description}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="h-14 rounded border border-slate-800 bg-slate-900/30 relative">
                  {timelineClips.map((clip) => {
                    const left = secondsToX(clip.start);
                    const width = Math.max(10, secondsToX(clip.end) - secondsToX(clip.start));
                    return (
                      <button
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          const file = files.find((f) => f.name === clip.blueprintId);
                          if (file) {
                            setActiveFileId(file.id);
                            setActiveTab('code');
                          }
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startDrag({ kind: 'clip', id: clip.id, action: 'move', originStart: clip.start, originEnd: clip.end }, e.clientX);
                        }}
                        className="absolute top-2 h-9 rounded-lg border text-left px-2 overflow-hidden"
                        style={{ left, width, background: `${clip.color}22`, borderColor: clip.color }}
                        title={`${clip.label} (${clip.start.toFixed(2)}s - ${clip.end.toFixed(2)}s)`}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize" onMouseDown={(e) => { e.stopPropagation(); startDrag({ kind: 'clip', id: clip.id, action: 'resize-start', originStart: clip.start, originEnd: clip.end }, e.clientX); }} />
                        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" onMouseDown={(e) => { e.stopPropagation(); startDrag({ kind: 'clip', id: clip.id, action: 'resize-end', originStart: clip.start, originEnd: clip.end }, e.clientX); }} />
                        <div className="text-[10px] font-bold truncate">{clip.label}</div>
                        <div className="text-[10px] text-slate-300 truncate">{clip.blueprintId}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="absolute top-0 bottom-0 w-px bg-white playhead z-30" style={{ left: `${secondsToX(currentTime)}px` }} />
              </div>
            </div>
          </footer>
        </section>

        <div className="w-1 cursor-col-resize bg-slate-900 hover:bg-red-500/60" onMouseDown={() => setIsResizing('right')}><GripVertical className="w-3 h-3 mx-auto mt-4 text-slate-500" /></div>
        <aside style={{ width: rightPanelWidth }} className="bg-[#0f0f1a] border-l border-slate-800/50 flex flex-col shrink-0">
          <div className="flex border-b border-slate-800/50">
            <button onClick={() => setActiveTab('helper')} className={`flex-1 py-2 text-[10px] uppercase font-black ${activeTab === 'helper' ? 'text-red-400 border-b-2 border-red-500' : 'text-slate-500'}`}>Helper</button>
            <button onClick={() => setActiveTab('code')} className={`flex-1 py-2 text-[10px] uppercase font-black ${activeTab === 'code' ? 'text-red-400 border-b-2 border-red-500' : 'text-slate-500'}`}>Code</button>
          </div>
          <div className="flex-1 min-h-0">
            {activeTab === 'helper' ? (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 text-xs border-b border-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-red-400" /> LLM Context-Aware Assistant</span>
                  <button onClick={() => navigator.clipboard.writeText(buildFullContext())} className="text-[10px] text-slate-400">Copy</button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {messages.map((m, i) => (
                    <div key={i} className={`p-2 text-xs rounded-xl whitespace-pre-wrap ${m.role === 'user' ? 'bg-red-600 ml-10' : 'bg-slate-800/60 mr-10 border border-slate-700'}`}>{m.content}</div>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-800 space-y-2">
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value as (typeof PUTER_MODELS)[number])} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs">
                    {PUTER_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                  <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-xs" placeholder="Ask the assistant to edit files, timeline, and segments..." />
                  <button onClick={handleSendMessage} className="w-full rounded bg-red-600 py-2 text-xs">Send</button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 flex items-center justify-between">
                  <span>{activeFile.name}</span>
                  <span className="text-slate-600">{activeFile.type}</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <Editor
                    value={activeFile.code}
                    onValueChange={(code) => setFiles((prev) => prev.map((f) => f.id === activeFileId ? { ...f, code } : f))}
                    highlight={(code) => Prism.highlight(code, Prism.languages.typescript, 'typescript')}
                    padding={14}
                    style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, minHeight: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      <SegmentModal
        segment={selectedSegment}
        duration={duration}
        onClose={() => setSelectedSegmentId('')}
        onSave={(segment) => setSegments((prev) => prev.map((s) => s.id === segment.id ? { ...segment, end: Math.max(segment.start, segment.end) } : s))}
        onDelete={(id) => setSegments((prev) => prev.filter((s) => s.id !== id))}
      />

      <ExportProgressModal
        isOpen={showExportModal}
        progress={exportProgress}
        done={exportProgress >= 100}
        onClose={() => setShowExportModal(false)}
      />

      <AudioAnalysisModal
        isOpen={showAnalysisModal}
        onClose={() => { setShowAnalysisModal(false); setAnalyzingAsset(null); }}
        asset={analyzingAsset}
        onSave={(id, metadata) => setAssets((prev) => prev.map((a) => a.id === id ? { ...a, metadata } : a))}
      />
    </div>
  );
};

export default App;
