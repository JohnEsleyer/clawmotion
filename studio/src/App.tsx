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
  props: { title: 'Build beautiful motion with ClawMotion', subtitle: 'Studio' },
  entry: { type: 'slide', durationTicks: claw.toTicks(1) },
  exit: { type: 'fade', durationTicks: claw.toTicks(1) }
});`
  },
  { id: 'gradient-showcase', name: 'gradient-showcase.claw', type: 'clip', code: `(ctx) => { const { ctx: c, width, height } = ctx; const g = c.createLinearGradient(0, 0, width, height); g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#ec4899'); c.fillStyle = g; c.fillRect(0, 0, width, height); }` },
  { id: 'hero-title', name: 'hero-title.claw', type: 'clip', code: `(ctx) => { const { ctx: c, width, height } = ctx; c.fillStyle = 'white'; c.font = '700 56px Inter'; c.textAlign = 'center'; c.fillText('ClawMotion Studio', width / 2, height / 2); }` }
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
    { id: 'seg-1', name: 'Hook', description: 'Grab attention with color and motion.', start: 0, end: 4, color: SEGMENT_COLORS[0] },
    { id: 'seg-2', name: 'Message', description: 'Reveal core statement and tone.', start: 4, end: 8, color: SEGMENT_COLORS[2] },
    { id: 'seg-3', name: 'Finish', description: 'Polished outro with easing.', start: 8, end: 12, color: SEGMENT_COLORS[4] }
  ]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

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

  const timelineTotalWidth = Math.max(1000, Math.round(1000 * timelineScale));

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    seekTime((x / timelineTotalWidth) * duration);
  };

  const clips = studioEngineRef.current?.getState().clips || [];

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
          <span className="font-bold tracking-tighter text-lg">clawmotion <span className="text-red-500">studio</span></span>
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
            <div ref={timelineRef} onClick={handleTimelineClick} className="flex-1 relative overflow-x-auto custom-scrollbar cursor-pointer">
              <div className="h-full p-2" style={{ width: timelineTotalWidth }}>
                <div className="text-[10px] uppercase font-black text-slate-500 mb-1">Timeline</div>

                <div className="h-12 rounded border border-slate-800 bg-slate-900/30 relative mb-2 overflow-hidden">
                  {segments.map((s) => (
                    <button
                      key={s.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedSegmentId(s.id); }}
                      className="absolute top-0 bottom-0 border-r border-black/30 text-left px-2"
                      style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%`, background: `${s.color}66` }}
                      title={`${s.name}: ${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s`}
                    >
                      <div className="text-[10px] font-semibold truncate">{s.name}</div>
                      <div className="text-[9px] opacity-80 truncate">{s.description}</div>
                    </button>
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
