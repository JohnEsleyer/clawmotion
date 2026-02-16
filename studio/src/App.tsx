import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Plus, Trash2, Download, Code, FileJson, Edit2, X,
  RefreshCw, ZoomIn, ZoomOut, Copy, GripVertical, GripHorizontal, Sparkles, FolderOpen,
  Image as ImageIcon, Music, Video, CircleHelp, LoaderCircle, WandSparkles
} from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';

if (typeof window !== 'undefined') {
  (window as any).Prism = Prism;
}
import 'prismjs/components/prism-typescript';

import { StudioEngine, analyzeAudioFile, detectBeats, generateAudioSummary } from './services/engine';
import { DEFAULT_LLM_CONFIG, PROVIDER_MODELS, generateClawCode } from './services/geminiService';
import { formatTypeScript } from './services/formatter';
import { ChatMessage, Asset, FileEntry, AudioMetadata, AudioAnalysisSettings, AudioSection, TimelineSegment, LLMConfig, LLMProvider } from './types';
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
  lane: number;
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
  const metadata = asset?.metadata;
  const [settings, setSettings] = useState<AudioAnalysisSettings>({ threshold: 1.3, minInterval: 0.25, offset: 0 });
  const [beats, setBeats] = useState<number[]>([]);
  const [sections, setSections] = useState<AudioSection[]>([]);
  const [previewTime, setPreviewTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!metadata) return;
    setSettings(metadata.settings);
    setBeats(metadata.beats || []);
    setSections(metadata.sections || []);
    setPreviewTime(0);
  }, [metadata]);

  useEffect(() => {
    if (metadata?.energies) {
      setBeats(detectBeats(metadata.energies, settings));
    }
  }, [metadata, settings]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (audioRef.current && isPreviewPlaying) {
        setPreviewTime(audioRef.current.currentTime || 0);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [isPreviewPlaying]);

  useEffect(() => {
    return () => {
      if (!audioRef.current) return;
      audioRef.current.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isOpen) return;
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPreviewPlaying(false);
    setPreviewTime(0);
  }, [isOpen]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current = null;
    setIsPreviewPlaying(false);
  }, [asset?.id]);

  if (!isOpen || !asset || !metadata) return null;

  const previewPulse = beats.reduce((strength, beat) => {
    const distance = Math.abs(beat - previewTime);
    if (distance > 0.2) return strength;
    return Math.max(strength, 1 - distance / 0.2);
  }, 0);

  const addSection = () => {
    const start = sections.length === 0 ? 0 : sections[sections.length - 1].end;
    const end = Math.min(metadata.duration, start + 2.5);
    const color = SEGMENT_COLORS[sections.length % SEGMENT_COLORS.length];
    setSections((prev) => ([...prev, { id: `sec-${Date.now()}`, label: `Section ${prev.length + 1}`, description: '', start, end, color }]));
  };

  const updateSection = (id: string, patch: Partial<AudioSection>) => {
    setSections((prev) => prev.map((section) => section.id === id ? { ...section, ...patch } : section));
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((section) => section.id !== id));
  };

  const timelineDuration = Math.max(1, metadata.duration);

  const handleTogglePreview = async () => {
    if (!audioRef.current) {
      const audio = new Audio(asset.url);
      audio.preload = 'auto';
      audio.currentTime = previewTime;
      audioRef.current = audio;
      audio.addEventListener('ended', () => {
        setIsPreviewPlaying(false);
      });
    }

    if (isPreviewPlaying) {
      audioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setIsPreviewPlaying(true);
    } catch {
      setIsPreviewPlaying(false);
    }
  };

  const handleSeekPreview = (time: number) => {
    const clamped = Math.max(0, Math.min(metadata.duration, time));
    setPreviewTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-8">
      <div className="bg-[#0f0f1a] border border-slate-700 w-full max-w-6xl rounded-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between gap-3 sticky top-0 bg-[#0f0f1a] py-1 z-10">
          <h2 className="text-lg font-bold">Audio Analysis: {asset.name}</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleTogglePreview} className="px-3 py-1.5 text-xs rounded bg-cyan-700 flex items-center gap-1">
              {isPreviewPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isPreviewPlaying ? 'Pause Preview' : 'Play Preview'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs">Threshold
            <input type="range" min="1" max="2.2" step="0.01" value={settings.threshold} onChange={(e) => setSettings({ ...settings, threshold: Number(e.target.value) })} className="w-full mt-1" />
            <div className="text-[10px] text-slate-400">{settings.threshold.toFixed(2)}</div>
          </label>
          <label className="text-xs">Min Interval
            <input type="range" min="0.05" max="1" step="0.01" value={settings.minInterval} onChange={(e) => setSettings({ ...settings, minInterval: Number(e.target.value) })} className="w-full mt-1" />
            <div className="text-[10px] text-slate-400">{settings.minInterval.toFixed(2)}s</div>
          </label>
          <label className="text-xs">Offset
            <input type="range" min="-1" max="1" step="0.01" value={settings.offset} onChange={(e) => setSettings({ ...settings, offset: Number(e.target.value) })} className="w-full mt-1" />
            <div className="text-[10px] text-slate-400">{settings.offset.toFixed(2)}s</div>
          </label>
        </div>

        <div className="rounded border border-slate-700 bg-slate-950/40 p-3 space-y-2">
          <div className="text-xs text-slate-400">Detected beats: {beats.length} · Sections: {sections.length}</div>
          <div className="relative h-20 rounded bg-slate-900/60 overflow-hidden">
            {beats.map((beat, idx) => (
              <div key={`${beat}-${idx}`} className="absolute top-0 bottom-0 w-[2px] bg-cyan-300/70" style={{ left: `${(beat / timelineDuration) * 100}%` }} />
            ))}
            {sections.map((section) => (
              <div key={section.id} className="absolute top-0 h-full opacity-25" style={{
                left: `${(section.start / timelineDuration) * 100}%`,
                width: `${((section.end - section.start) / timelineDuration) * 100}%`,
                backgroundColor: section.color
              }} />
            ))}
            <button
              className="absolute top-0 bottom-0 w-[3px] bg-white cursor-ew-resize"
              style={{ left: `${(previewTime / timelineDuration) * 100}%` }}
              onMouseDown={(e) => {
                const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                handleSeekPreview(((e.clientX - rect.left) / rect.width) * timelineDuration);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded bg-slate-900/70 border border-slate-800 p-3">
              <div className="text-xs text-slate-400 mb-2">Beat timestamps (s)</div>
              <div className="max-h-28 overflow-y-auto custom-scrollbar text-[11px] text-slate-200 font-mono leading-5">
                {beats.length === 0 ? 'No beats detected.' : beats.map((beat, index) => (
                  <span key={`${beat}-${index}`} className="inline-block mr-2">{beat.toFixed(2)}</span>
                ))}
              </div>
            </div>
            <div className="rounded bg-slate-900/70 border border-slate-800 p-3">
              <div className="text-xs text-slate-400 mb-2">Beat dancer preview</div>
              <div className="h-20 rounded border border-slate-700 bg-black/60 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-pink-500 transition-transform duration-75" style={{ transform: `translateY(${Math.sin(previewTime * 6) * -6}px) scale(${1 + previewPulse * 0.5})` }} />
              </div>
              <div className="text-[10px] text-slate-500 mt-2">Preview time: {previewTime.toFixed(2)}s</div>
            </div>
          </div>
        </div>

        <div className="rounded border border-slate-700 bg-slate-950/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Segments</h3>
            <button onClick={addSection} className="text-[11px] px-2 py-1 rounded bg-cyan-700">Add Segment</button>
          </div>
          <div className="space-y-2 max-h-[34vh] overflow-y-auto custom-scrollbar">
            {sections.length === 0 && <div className="text-xs text-slate-500">No segments yet. Add descriptive sections to help the LLM understand musical structure.</div>}
            {sections.map((section) => (
              <div key={section.id} className="rounded border border-slate-800 p-2 bg-slate-900/40">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input value={section.label} onChange={(e) => updateSection(section.id, { label: e.target.value })} className="col-span-3 bg-slate-950 border border-slate-700 rounded p-2 text-xs" placeholder="Title" />
                  <input value={section.description || ''} onChange={(e) => updateSection(section.id, { description: e.target.value })} className="col-span-5 bg-slate-950 border border-slate-700 rounded p-2 text-xs" placeholder="Description" />
                  <input type="number" step="0.1" value={section.start} onChange={(e) => updateSection(section.id, { start: Math.max(0, Number(e.target.value)) })} className="col-span-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs" />
                  <input type="number" step="0.1" value={section.end} onChange={(e) => updateSection(section.id, { end: Math.min(metadata.duration, Number(e.target.value)) })} className="col-span-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs" />
                  <input type="color" value={section.color} onChange={(e) => updateSection(section.id, { color: e.target.value })} className="col-span-1 h-8 w-full bg-transparent" />
                  <button onClick={() => removeSection(section.id)} className="col-span-1 text-red-400 text-xs"><Trash2 className="w-4 h-4 mx-auto" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs">Cancel</button>
          <button onClick={() => {
            const normalizedSections = sections
              .filter((section) => section.end > section.start)
              .sort((a, b) => a.start - b.start);
            const nextMetadata: AudioMetadata = {
              ...metadata,
              beats,
              sections: normalizedSections,
              settings,
              summary: generateAudioSummary(metadata.duration, beats, normalizedSections)
            };
            onSave(asset.id, nextMetadata);
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

const TimelineHelpModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[210] bg-black/85 p-8 flex items-center justify-center">
      <div className="bg-[#0f0f1a] border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2"><CircleHelp className="w-5 h-5 text-cyan-300" />Timeline Guide</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3 text-sm text-slate-300">
          <p><span className="font-semibold text-slate-100">Segments</span> are planning blocks. Use them to describe the story flow (intro, build-up, outro). They do not render visuals directly.</p>
          <p><span className="font-semibold text-slate-100">Clips</span> are the actual render items from your <code className="text-cyan-300">*.claw</code> files. Each clip has a start and duration, and can overlap with other clips in different lanes.</p>
          <p><span className="font-semibold text-slate-100">Playhead</span> is the vertical white line. Drag it anywhere to scrub and preview that exact moment.</p>
          <p><span className="font-semibold text-slate-100">Handles</span> on the left and right side of segment/clip blocks resize timing. Drag the middle of a block to move it.</p>
          <p><span className="font-semibold text-slate-100">Zoom</span> controls change timeline scale so you can edit either broad structure or frame-level details.</p>
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
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [autoFormatEnabled, setAutoFormatEnabled] = useState(true);
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
  const [showTimelineHelp, setShowTimelineHelp] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [clipOverrides, setClipOverrides] = useState<Record<string, { start: number; end: number }>>({});
  const [dragTarget, setDragTarget] = useState<TimelineDragTarget | null>(null);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const studioEngineRef = useRef<StudioEngine | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('clawstudio.llm.config');
      if (!raw) return;
      const parsed = JSON.parse(raw) as LLMConfig;
      if (!parsed.provider || !parsed.model) return;
      setLlmConfig(parsed);
    } catch {
      // ignore invalid persisted config
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('clawstudio.llm.config', JSON.stringify(llmConfig));
  }, [llmConfig]);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;

  const updateFileCode = (targetFileId: string, code: string) => {
    const nextCode = autoFormatEnabled ? formatTypeScript(code) : code;
    setFiles((prev) => prev.map((file) => file.id === targetFileId ? { ...file, code: nextCode } : file));
  };

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

  const timelineClips: TimelineClipUI[] = clips
    .map((clip: any, idx: number) => {
      const clipId = clip.id || `clip-${idx}-${clip.blueprintId}`;
      const baseStart = clip.startTick / 30;
      const baseEnd = (clip.startTick + clip.durationTicks) / 30;
      const override = clipOverrides[clipId];
      return {
        id: clipId,
        clipIndex: idx,
        lane: 0,
        blueprintId: clip.blueprintId,
        label: clip.id || clip.blueprintId,
        start: override?.start ?? baseStart,
        end: override?.end ?? baseEnd,
        color: `hsl(${(idx * 47) % 360} 80% 55%)`
      };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const laneEnds: number[] = [];
  timelineClips.forEach((clip) => {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= clip.start + 0.0001);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(clip.end);
    } else {
      laneEnds[lane] = clip.end;
    }
    clip.lane = lane;
  });

  const clipLaneHeight = 34;
  const clipLaneGap = 8;
  const clipTrackHeight = Math.max(56, timelineClips.length > 0
    ? timelineClips.reduce((maxLane, clip) => Math.max(maxLane, clip.lane), 0) * (clipLaneHeight + clipLaneGap) + clipLaneHeight + 14
    : 56);

  const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
    return aStart < bEnd - 0.0001 && bStart < aEnd - 0.0001;
  };


  const clipLaneById = new Map(timelineClips.map((clip) => [clip.id, clip.lane]));


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

          let nextStart = segment.start;
          let nextEnd = segment.end;
          if (dragTarget.action === 'move') {
            const span = dragTarget.originEnd - dragTarget.originStart;
            nextStart = Math.max(0, Math.min(duration - span, dragTarget.originStart + delta));
            nextEnd = nextStart + span;
          } else if (dragTarget.action === 'resize-start') {
            nextStart = Math.max(0, Math.min(dragTarget.originEnd - MIN_CLIP_DURATION, dragTarget.originStart + delta));
          } else {
            nextEnd = Math.min(duration, Math.max(dragTarget.originStart + MIN_CLIP_DURATION, dragTarget.originEnd + delta));
          }

          const collides = prev.some((other) => {
            if (other.id === segment.id) return false;
            return rangesOverlap(nextStart, nextEnd, other.start, other.end);
          });

          if (collides) return segment;
          return { ...segment, start: nextStart, end: nextEnd };
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

          const lane = clipLaneById.get(dragTarget.id);
          const collides = timelineClips.some((clip) => {
            if (clip.id === dragTarget.id) return false;
            if (clip.lane !== lane) return false;
            return rangesOverlap(start, end, clip.start, clip.end);
          });

          if (collides) return prev;
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

  const applyAssistantCommands = (raw: string) => {
    const commands = [...raw.matchAll(/CMD:\s*(setDuration|setSize)\(([^\n)]+)\)/g)];
    commands.forEach((match) => {
      if (match[1] === 'setDuration') {
        const value = Number(match[2].replace(/[^0-9.\-]/g, ''));
        if (Number.isFinite(value) && value > 0) {
          setDuration(value);
        }
      }
      if (match[1] === 'setSize') {
        const size = match[2].replace(/["'\s]/g, '');
        const found = SCREEN_SIZES.find((item) => item.id === size);
        if (found) setSelectedSize(found);
      }
    });

    const fileBlocks = [...raw.matchAll(/File:\s*([^\n]+)\n```(?:typescript|ts|tsx)?\n([\s\S]*?)```/g)];
    for (const block of fileBlocks) {
      const fileName = block[1].trim();
      const rawCode = block[2].trim();
      const code = autoFormatEnabled ? formatTypeScript(rawCode) : rawCode;
      setFiles((prev) => {
        const existing = prev.find((file) => file.name === fileName);
        if (existing) {
          return prev.map((file) => file.id === existing.id ? { ...file, code } : file);
        }
        const type = fileName.endsWith('.claw') ? 'clip' : 'orchestrator';
        return [...prev, { id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: fileName, code, type }];
      });
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSendingMessage) return;
    const userMessage = chatInput;
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, timestamp: Date.now(), status: 'done' }]);
    setChatInput('');
    setIsSendingMessage(true);

    const prompt = `${userMessage}\n\n${buildFullContext()}`;
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Thinking...', timestamp: Date.now(), status: 'pending' }]);

    try {
      const result = await generateClawCode(prompt, files, assets, llmConfig);
      applyAssistantCommands(result);
      setMessages((prev) => {
        const copy = [...prev];
        const pendingIndex = [...copy].reverse().findIndex((msg) => msg.role === 'assistant' && msg.status === 'pending');
        if (pendingIndex >= 0) {
          const realIndex = copy.length - 1 - pendingIndex;
          copy[realIndex] = { role: 'assistant', content: result, timestamp: Date.now(), status: 'done' };
          return copy;
        }
        return [...copy, { role: 'assistant', content: result, timestamp: Date.now(), status: 'done' }];
      });
    } catch (err) {
      const content = err instanceof Error ? err.message : 'Failed to process request.';
      setMessages((prev) => {
        const copy = [...prev];
        const pendingIndex = [...copy].reverse().findIndex((msg) => msg.role === 'assistant' && msg.status === 'pending');
        if (pendingIndex >= 0) {
          const realIndex = copy.length - 1 - pendingIndex;
          copy[realIndex] = { role: 'assistant', content, timestamp: Date.now(), status: 'error' };
          return copy;
        }
        return [...copy, { role: 'assistant', content, timestamp: Date.now(), status: 'error' }];
      });
    } finally {
      setIsSendingMessage(false);
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
              <button
                onClick={() => setShowTimelineHelp(true)}
                className="p-1 rounded border border-slate-700 bg-slate-900 text-cyan-300 hover:text-cyan-200"
                title="Timeline help"
              >
                <CircleHelp className="w-4 h-4" />
              </button>
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

                <div className="rounded border border-slate-800 bg-slate-900/30 relative" style={{ height: clipTrackHeight }}>
                  {timelineClips.map((clip) => {
                    const left = secondsToX(clip.start);
                    const width = Math.max(10, secondsToX(clip.end) - secondsToX(clip.start));
                    const top = 6 + clip.lane * (clipLaneHeight + clipLaneGap);
                    const durationLabel = `${(clip.end - clip.start).toFixed(2)}s`;
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
                        className="absolute h-8 rounded-md border text-left px-2 overflow-hidden shadow-sm"
                        style={{ left, width, top, background: clip.color, borderColor: `${clip.color}dd` }}
                        title={`${clip.label} (${clip.start.toFixed(2)}s - ${clip.end.toFixed(2)}s)`}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize" onMouseDown={(e) => { e.stopPropagation(); startDrag({ kind: 'clip', id: clip.id, action: 'resize-start', originStart: clip.start, originEnd: clip.end }, e.clientX); }} />
                        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" onMouseDown={(e) => { e.stopPropagation(); startDrag({ kind: 'clip', id: clip.id, action: 'resize-end', originStart: clip.start, originEnd: clip.end }, e.clientX); }} />
                        <div className="text-[10px] font-bold text-slate-950 truncate tracking-tight">
                          {clip.label}
                          {width >= 130 && <span className="ml-1.5 opacity-70">• {durationLabel}</span>}
                        </div>
                        {width >= 190 && <div className="text-[9px] text-slate-950/70 truncate">{clip.blueprintId}</div>}
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
                    <div key={i} className={`p-2 text-xs rounded-xl whitespace-pre-wrap ${m.role === 'user' ? 'bg-red-600 ml-10' : 'bg-slate-800/60 mr-10 border border-slate-700'}`}>
                      {m.status === 'pending' && <LoaderCircle className="w-3 h-3 inline mr-1 animate-spin text-cyan-300" />}
                      {m.content}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-800 space-y-2">
                  <select value={llmConfig.provider} onChange={(e) => {
                    const provider = e.target.value as LLMProvider;
                    setLlmConfig((prev) => ({ ...prev, provider, model: PROVIDER_MODELS[provider][0] }));
                  }} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs">
                    <option value="puter">Puter (built in)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="gemini">Google Gemini</option>
                  </select>

                  <select value={llmConfig.model} onChange={(e) => setLlmConfig((prev) => ({ ...prev, model: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs">
                    {PROVIDER_MODELS[llmConfig.provider].map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>

                  {llmConfig.provider !== 'puter' && (
                    <input
                      type="password"
                      value={llmConfig.apiKey || ''}
                      onChange={(e) => setLlmConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs"
                      placeholder={`Enter ${llmConfig.provider} API key (stored locally)`}
                    />
                  )}

                  <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-xs" placeholder="Ask the assistant to edit files, timeline, and segments..." />
                  <button onClick={handleSendMessage} disabled={isSendingMessage} className="w-full rounded bg-red-600 py-2 text-xs disabled:opacity-60 flex items-center justify-center gap-2">
                    {isSendingMessage ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {isSendingMessage ? 'Generating...' : 'Send'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 border-b border-slate-800 text-[10px] uppercase text-slate-500 flex items-center justify-between gap-2">
                  <span>{activeFile.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateFileCode(activeFileId, activeFile.code)} className="normal-case text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300 flex items-center gap-1"><WandSparkles className="w-3 h-3" /> Format</button>
                    <label className="normal-case text-[10px] text-slate-400 flex items-center gap-1">
                      <input type="checkbox" checked={autoFormatEnabled} onChange={(e) => setAutoFormatEnabled(e.target.checked)} />
                      Auto-format
                    </label>
                    <span className="text-slate-600">{activeFile.type}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-auto">
                  <Editor
                    value={activeFile.code}
                    onValueChange={(code) => updateFileCode(activeFileId, code)}
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

      <TimelineHelpModal
        isOpen={showTimelineHelp}
        onClose={() => setShowTimelineHelp(false)}
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
