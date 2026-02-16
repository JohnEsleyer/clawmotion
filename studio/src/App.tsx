import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Plus, Trash2, FolderOpen, Download, Code, FileJson, Edit2, Check, X,
  RefreshCw, ZoomIn, ZoomOut, Copy, GripVertical, GripHorizontal, Sparkles
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

const AssetModal: React.FC<{
  isOpen: boolean;
  assets: Asset[];
  onClose: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyze: (asset: Asset) => void;
  onDelete: (id: string) => void;
}> = ({ isOpen, assets, onClose, onImport, onAnalyze, onDelete }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] bg-black/90 p-8 flex items-center justify-center">
      <div className="bg-[#0f0f1a] border border-slate-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold">Asset Library</h3>
          <div className="flex gap-2">
            <label className="px-3 py-2 text-xs rounded bg-red-600 cursor-pointer">Upload<input ref={inputRef} type="file" multiple className="hidden" accept="image/*,video/*,audio/*" onChange={onImport} /></label>
            <button onClick={onClose}><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          {assets.map((a) => (
            <div key={a.id} className="bg-slate-900 border border-slate-800 rounded p-2 text-xs">
              <div className="truncate mb-2">{a.name}</div>
              <div className="text-slate-400 mb-2">{a.type}</div>
              <div className="flex gap-1">
                {a.type === 'audio' && <button onClick={() => onAnalyze(a)} className="px-2 py-1 rounded bg-emerald-700">Analyze</button>}
                <button onClick={() => onDelete(a.id)} className="px-2 py-1 rounded bg-red-700">Delete</button>
              </div>
            </div>
          ))}
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
  id: 'gradient-intro',
  blueprintId: 'gradient-showcase.claw',
  startTick: claw.toTicks(0),
  durationTicks: claw.toTicks(6),
  layer: 0,
  props: { palette: ['#0b1020', '#4c1d95', '#ec4899'] },
  entry: { type: 'fade', durationTicks: claw.toTicks(0.8) },
  exit: { type: 'zoom', durationTicks: claw.toTicks(0.8) }
});

claw.addClip({
  id: 'text-reveal',
  blueprintId: 'hero-title.claw',
  startTick: claw.toTicks(2),
  durationTicks: claw.toTicks(8),
  layer: 10,
  props: { title: 'Build beautiful motion with ClawMotion', subtitle: 'Programmatic and deterministic' },
  entry: { type: 'slide', durationTicks: claw.toTicks(1) },
  exit: { type: 'fade', durationTicks: claw.toTicks(1) }
});

claw.addClip({
  id: 'particles',
  blueprintId: 'particle-field.claw',
  startTick: claw.toTicks(4),
  durationTicks: claw.toTicks(8),
  layer: 4,
  entry: { type: 'fade', durationTicks: claw.toTicks(1) },
  exit: { type: 'fade', durationTicks: claw.toTicks(1) }
});`
  },
  {
    id: 'gradient-showcase',
    name: 'gradient-showcase.claw',
    type: 'clip',
    code: `(ctx) => {
  const { ctx: c, width, height, localTime, props } = ctx;
  const palette = props.palette || ['#0b1020', '#312e81', '#db2777'];
  const g = c.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, palette[0]);
  g.addColorStop(0.5 + Math.sin(localTime * Math.PI) * 0.2, palette[1]);
  g.addColorStop(1, palette[2]);
  c.fillStyle = g;
  c.fillRect(0, 0, width, height);
}`
  },
  {
    id: 'hero-title',
    name: 'hero-title.claw',
    type: 'clip',
    code: `(ctx) => {
  const { ctx: c, width, height, localTime, props } = ctx;
  const y = height * 0.52 - Math.sin(localTime * Math.PI) * 18;
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.font = '700 56px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText(props.title || 'ClawMotion', width / 2, y);
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.font = '500 24px Inter, sans-serif';
  c.fillText(props.subtitle || 'Studio', width / 2, y + 46);
}`
  },
  {
    id: 'particles',
    name: 'particle-field.claw',
    type: 'clip',
    code: `(ctx) => {
  const { ctx: c, width, height, localTime, utils } = ctx;
  for (let i = 0; i < 70; i++) {
    const x = (i * 137.7) % width;
    const drift = Math.sin(localTime * Math.PI * 2 + i * 0.2) * 80;
    const y = ((i * 91.5) % height + drift + height) % height;
    const r = 1 + ((i * 17) % 5);
    c.fillStyle = 'rgba(255,255,255,' + (0.05 + (i % 10) * 0.015) + ')';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
}`
  }
]);

const App: React.FC = () => {
  const [duration, setDuration] = useState(12);
  const [selectedSize, setSelectedSize] = useState(SCREEN_SIZES[0]);
  const [files, setFiles] = useState<FileEntry[]>(buildDefaultFiles());
  const [activeFileId, setActiveFileId] = useState('orch');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analyzingAsset, setAnalyzingAsset] = useState<Asset | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [timelineScale, setTimelineScale] = useState(1);
  const [leftPanelWidth, setLeftPanelWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(430);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(250);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | 'bottom' | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Welcome to ClawStudio. Describe what you want to build.', timestamp: Date.now() }]);
  const [chatInput, setChatInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<(typeof PUTER_MODELS)[number]>(PUTER_MODELS[0]);
  const [activeTab, setActiveTab] = useState<'helper' | 'code'>('helper');
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<TimelineSegment[]>([
    { id: 'seg-1', name: 'Hook', description: 'Grab attention with color and motion.', start: 0, end: 4, color: SEGMENT_COLORS[0] },
    { id: 'seg-2', name: 'Message', description: 'Reveal core statement and tone.', start: 4, end: 8, color: SEGMENT_COLORS[2] },
    { id: 'seg-3', name: 'Finish', description: 'Polished outro with easing.', start: 8, end: 12, color: SEGMENT_COLORS[4] }
  ]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('seg-1');

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const studioEngineRef = useRef<StudioEngine | null>(null);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

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
      if (isResizing === 'left') setLeftPanelWidth(Math.max(180, Math.min(500, e.clientX)));
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

  const timelineTotalWidth = Math.max(1000, Math.round(1000 * timelineScale));

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    seekTime((x / timelineTotalWidth) * duration);
  };

  const clips = studioEngineRef.current?.getState().clips || [];

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || segments[0];

  const buildFullContext = () => {
    const clipSummaries = clips.map((c: any) => `${c.id || c.blueprintId}: ${c.blueprintId} [${(c.startTick / 30).toFixed(2)}s - ${((c.startTick + c.durationTicks) / 30).toFixed(2)}s]`).join('\n');
    const segmentSummary = segments.map((s) => `- ${s.name} (${s.start.toFixed(2)}-${s.end.toFixed(2)}): ${s.description}`).join('\n');

    return `# Studio Context\n\n${FULL_COMPREHENSIVE_GUIDE}\n\n## Timeline Segments\n${segmentSummary}\n\n## Active Clips\n${clipSummaries || 'none'}\n\n## Files\n${files.map((f) => `- ${f.name} (${f.type})`).join('\n')}\n\n## Assets\n${assets.map((a) => `- ${a.name} (${a.type}) ${a.metadata ? `[${a.metadata.summary}]` : ''}`).join('\n') || 'none'}\n\n## Current File (${activeFile.name})\n\n\`\`\`typescript\n${activeFile.code}\n\`\`\``;
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0a0f] text-slate-200">
      <header className="flex items-center justify-between px-4 py-2 bg-[#0f0f1a] border-b border-red-900/30 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <ClawLogo />
          <span className="font-bold text-white tracking-tighter text-lg">clawmotion studio</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigator.clipboard.writeText(buildFullContext())} className="px-3 py-1.5 text-xs rounded bg-slate-800"><Copy className="w-3 h-3 inline mr-1" />Copy Full Context</button>
          <button onClick={() => setShowAssetModal(true)} className="px-3 py-1.5 text-xs rounded bg-slate-800"><FolderOpen className="w-3 h-3 inline mr-1" />Assets</button>
          <button className="px-3 py-1.5 text-xs rounded bg-red-600"><Download className="w-3 h-3 inline mr-1" />Export</button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex relative">
        <aside style={{ width: leftPanelWidth }} className="bg-[#0f0f1a] border-r border-slate-800/50 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/50 flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Explorer</h2>
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
        </aside>
        <div className="w-1 cursor-col-resize bg-slate-900 hover:bg-red-500/60" onMouseDown={() => setIsResizing('left')}><GripVertical className="w-3 h-3 mx-auto mt-4 text-slate-500" /></div>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 bg-[#050505] relative p-4">
            <div className="absolute top-4 left-4 right-4 h-12 z-20 rounded-xl border border-slate-700/70 bg-black/60 backdrop-blur-md px-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select value={selectedSize.id} onChange={(e) => setSelectedSize(SCREEN_SIZES.find((s) => s.id === e.target.value)!)} className="text-xs bg-transparent">
                  {SCREEN_SIZES.map((s) => <option key={s.id} value={s.id} className="bg-slate-900">{s.label}</option>)}
                </select>
                <label className="text-xs">Duration
                  <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 1)} className="w-12 ml-1 bg-transparent" />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="px-2 py-1 text-xs rounded bg-red-600">{isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</button>
                <button onClick={rebuildEngine} className="px-2 py-1 text-xs rounded bg-slate-800"><RefreshCw className="w-3 h-3" /></button>
              </div>
            </div>

            <div ref={playerContainerRef} className="relative w-full h-full border border-zinc-800 bg-black rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.7)]" style={{ aspectRatio: `${selectedSize.width}/${selectedSize.height}` }} />
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
            </div>
            <div className="flex-1 min-h-0 flex">
              <div className="w-72 border-r border-slate-800 p-2 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] uppercase font-black text-slate-500">Segments</h3>
                  <button onClick={() => {
                    const idx = segments.length % SEGMENT_COLORS.length;
                    const seg: TimelineSegment = { id: `seg-${Date.now()}`, name: `Segment ${segments.length + 1}`, description: 'Describe desired flow for this segment.', start: Math.max(0, currentTime), end: Math.min(duration, currentTime + 2), color: SEGMENT_COLORS[idx] };
                    setSegments((prev) => [...prev, seg]);
                    setSelectedSegmentId(seg.id);
                  }}><Plus className="w-3 h-3" /></button>
                </div>
                <div className="space-y-2">
                  {segments.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSegmentId(s.id)} className={`w-full text-left rounded border p-2 ${selectedSegmentId === s.id ? 'border-red-500 bg-red-900/10' : 'border-slate-700 bg-slate-900/40'}`}>
                      <div className="text-xs font-semibold truncate">{s.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{s.start.toFixed(1)}s - {s.end.toFixed(1)}s</div>
                    </button>
                  ))}
                </div>
                {selectedSegment && (
                  <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                    <input value={selectedSegment.name} onChange={(e) => setSegments((prev) => prev.map((s) => s.id === selectedSegment.id ? { ...s, name: e.target.value } : s))} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs" />
                    <textarea value={selectedSegment.description} onChange={(e) => setSegments((prev) => prev.map((s) => s.id === selectedSegment.id ? { ...s, description: e.target.value } : s))} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs h-16" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" step="0.1" value={selectedSegment.start} onChange={(e) => setSegments((prev) => prev.map((s) => s.id === selectedSegment.id ? { ...s, start: Math.max(0, Number(e.target.value)) } : s))} className="bg-slate-900 border border-slate-700 rounded p-1 text-xs" />
                      <input type="number" step="0.1" value={selectedSegment.end} onChange={(e) => setSegments((prev) => prev.map((s) => s.id === selectedSegment.id ? { ...s, end: Math.min(duration, Number(e.target.value)) } : s))} className="bg-slate-900 border border-slate-700 rounded p-1 text-xs" />
                    </div>
                    <button onClick={() => {
                      setSegments((prev) => prev.filter((s) => s.id !== selectedSegment.id));
                      setSelectedSegmentId(segments[0]?.id || '');
                    }} className="w-full text-xs bg-red-700 rounded p-1">Delete Segment</button>
                  </div>
                )}
              </div>

              <div ref={timelineRef} onClick={handleTimelineClick} className="flex-1 relative overflow-x-auto custom-scrollbar cursor-pointer">
                <div className="h-full p-2" style={{ width: timelineTotalWidth }}>
                  <div className="text-[10px] uppercase font-black text-slate-500 mb-1">Timeline</div>
                  <div className="h-8 rounded border border-slate-800 bg-slate-900/30 relative mb-2">
                    {segments.map((s) => (
                      <div key={s.id} className="absolute h-6 top-1 rounded border" style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%`, background: `${s.color}33`, borderColor: s.color }}>
                        <span className="text-[10px] px-1">{s.name}</span>
                      </div>
                    ))}
                  </div>

                  <div className="h-14 rounded border border-slate-800 bg-slate-900/30 relative">
                    {clips.map((clip: any, idx: number) => {
                      const start = clip.startTick / 30;
                      const end = (clip.startTick + clip.durationTicks) / 30;
                      const color = `hsl(${(idx * 47) % 360} 80% 55%)`;
                      return (
                        <button
                          key={clip.id || idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            const file = files.find((f) => f.name === clip.blueprintId);
                            if (file) {
                              setActiveFileId(file.id);
                              setActiveTab('code');
                            }
                          }}
                          className="absolute top-2 h-9 rounded-lg border text-left px-2 overflow-hidden"
                          style={{ left: `${(start / duration) * 100}%`, width: `${((end - start) / duration) * 100}%`, background: `${color}22`, borderColor: color }}
                          title={`${clip.id || clip.blueprintId} (${start.toFixed(2)}s - ${end.toFixed(2)}s)`}
                        >
                          <div className="text-[10px] font-bold truncate">{clip.id || clip.blueprintId}</div>
                          <div className="text-[10px] text-slate-300 truncate">{clip.blueprintId}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="absolute top-0 bottom-0 w-px bg-white playhead z-30" style={{ left: `${(currentTime / duration) * 100}%` }} />
                </div>
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

      <AssetModal
        isOpen={showAssetModal}
        onClose={() => setShowAssetModal(false)}
        assets={assets}
        onImport={handleImportAssets}
        onAnalyze={(asset) => { setAnalyzingAsset(asset); setShowAnalysisModal(true); }}
        onDelete={(id) => setAssets((prev) => prev.filter((a) => a.id !== id))}
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
