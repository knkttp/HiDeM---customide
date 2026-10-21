import React, { useRef } from 'react';
import { X, Upload, Link2, Sparkles, Sliders, Palette, RotateCcw } from 'lucide-react';

export type IdeThemeId =
  | 'one-dark-pro'
  | 'dracula'
  | 'monokai-pro'
  | 'github-dark'
  | 'solarized-light';

export interface ThemeConfig {
  wallpaperUrl: string;
  blurPx: number;
  opacity: number;
  theme: IdeThemeId;
}

export const IDE_THEMES: { id: IdeThemeId; name: string; previewBg: string; accent: string }[] = [
  { id: 'one-dark-pro', name: 'One Dark Pro', previewBg: '#282c34', accent: '#61afef' },
  { id: 'dracula', name: 'Dracula', previewBg: '#282a36', accent: '#ff79c6' },
  { id: 'monokai-pro', name: 'Monokai Pro', previewBg: '#2d2a2e', accent: '#ffd866' },
  { id: 'github-dark', name: 'GitHub Dark', previewBg: '#0d1117', accent: '#58a6ff' },
  { id: 'solarized-light', name: 'Solarized Light', previewBg: '#fdf6e3', accent: '#268bd2' },
];

export const PRESET_WALLPAPERS = [
  {
    label: 'Cyberpunk Neon',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=85',
  },
  {
    label: 'Deep Aurora',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1920&q=85',
  },
  {
    label: 'Mountain Mist',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=85',
  },
  {
    label: 'Lo-Fi Night City',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1920&q=85',
  },
];

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ThemeConfig;
  onChange: (next: ThemeConfig) => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ ...config, wallpaperUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    onChange({
      wallpaperUrl: PRESET_WALLPAPERS[0].url,
      blurPx: 12,
      opacity: 0.72,
      theme: 'one-dark-pro',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-slate-900/95 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold tracking-tight">
              Wallpaper Blur & Code Themes Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Code Theme Selector (5 Themes) */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              <Palette className="w-4 h-4 text-indigo-400" />
              Code Editor Theme (5 VSCode Color Schemes)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {IDE_THEMES.map((t) => {
                const active = config.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange({ ...config, theme: t.id })}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-sm'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-white/25 flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${t.previewBg} 55%, ${t.accent} 45%)`,
                      }}
                    />
                    <span className="text-xs font-medium truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wallpaper Image Input (Upload Base64 or Direct URL) */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Link2 className="w-4 h-4 text-indigo-400" />
              Custom Wallpaper (Direct Image URL or Local File Upload)
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={config.wallpaperUrl.startsWith('data:') ? '' : config.wallpaperUrl}
                onChange={(e) => onChange({ ...config, wallpaperUrl: e.target.value })}
                placeholder={
                  config.wallpaperUrl.startsWith('data:')
                    ? 'Using uploaded local image (Base64)...'
                    : 'Paste image URL (https://...)'
                }
                className="flex-1 rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-medium text-white transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Image
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESET_WALLPAPERS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange({ ...config, wallpaperUrl: p.url })}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/15 hover:text-white transition"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders: Blur (0px -> 30px) & Opacity (0.15 -> 0.95) */}
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Real-Time Frosted Glass Effect (CSS Backdrop Filter)
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Backdrop Blur</span>
                <span className="font-mono text-indigo-400">{config.blurPx}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={config.blurPx}
                onChange={(e) => onChange({ ...config, blurPx: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0px (Sharp)</span>
                <span>15px</span>
                <span>30px (Ultra Blur)</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Overlay Opacity</span>
                <span className="font-mono text-indigo-400">
                  {Math.round(config.opacity * 100)}% ({config.opacity.toFixed(2)})
                </span>
              </div>
              <input
                type="range"
                min={0.15}
                max={0.95}
                step={0.01}
                value={config.opacity}
                onChange={(e) => onChange({ ...config, opacity: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.15 (Translucent)</span>
                <span>0.55</span>
                <span>0.95 (Opaque)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/60 px-6 py-3.5">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-semibold text-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
