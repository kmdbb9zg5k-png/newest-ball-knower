import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Pencil, Trash2, UserRound, X } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { ModalPortal } from './ModalPortal';
import {
  AvatarCrop,
  canvasToProfilePhoto,
  drawSquareProfileImage,
  removeProfilePhoto,
  uploadProfilePhoto,
  validateProfilePhotoFile,
} from './profilePhoto';

const ACCEPTED_PHOTOS = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
const INITIAL_CROP: AvatarCrop = { zoom: 1, x: 50, y: 50 };

const initials = (name: string) => name
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map(part => part[0] || '')
  .join('')
  .toUpperCase() || 'BK';

export const ProfilePhotoEditor: React.FC = () => {
  const { currentUser, updateCurrentUserAvatar, showToast } = useBallKnower();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const sourceUrlRef = useRef('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<AvatarCrop>(INITIAL_CROP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasPhoto = Boolean(currentUser?.avatarUrl);

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
  }, []);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const image = sourceImageRef.current;
    if (!canvas || !image || !image.complete || !image.naturalWidth) return;
    drawSquareProfileImage(canvas, image, crop);
  }, [crop, file]);

  const closeEditor = () => {
    setFile(null);
    setCrop(INITIAL_CROP);
    setError('');
    sourceImageRef.current = null;
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = '';
  };

  const chooseFile = (selected?: File) => {
    if (!selected) return;
    try {
      validateProfilePhotoFile(selected);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      const url = URL.createObjectURL(selected);
      sourceUrlRef.current = url;
      const image = new Image();
      image.onload = () => {
        sourceImageRef.current = image;
        const canvas = previewCanvasRef.current;
        if (canvas) drawSquareProfileImage(canvas, image, INITIAL_CROP);
      };
      image.onerror = () => {
        setError('That photo could not be opened. Try another image.');
        URL.revokeObjectURL(url);
        sourceUrlRef.current = '';
      };
      image.src = url;
      setCrop(INITIAL_CROP);
      setError('');
      setFile(selected);
      setActionsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That photo cannot be used.');
    }
  };

  const save = async () => {
    if (!file || !previewCanvasRef.current || busy) return;
    setBusy(true);
    setError('');
    try {
      const blob = await canvasToProfilePhoto(previewCanvasRef.current);
      const result = await uploadProfilePhoto(blob, currentUser?.avatarPath);
      updateCurrentUserAvatar(result.avatarUrl, result.avatarPath);
      showToast('Profile photo updated everywhere.');
      closeEditor();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profile photo could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !window.confirm('Remove your Ball Knower profile photo?')) return;
    setBusy(true);
    setError('');
    try {
      await removeProfilePhoto(currentUser?.avatarPath);
      updateCurrentUserAvatar(undefined, undefined);
      setActionsOpen(false);
      showToast('Profile photo removed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profile photo could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <section className="mb-3 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
      <button
        type="button"
        aria-label={hasPhoto ? 'Change profile photo' : 'Add profile photo'}
        onClick={() => setActionsOpen(true)}
        className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[var(--bk-team-accent)]/60 bg-[#171b22] text-xl font-black text-[var(--bk-team-accent)]"
      >
        {currentUser ? initials(currentUser.name) : <UserRound className="h-8 w-8" />}
        {currentUser?.avatarUrl && <img src={currentUser.avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} />}
        <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border border-black bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]"><Pencil className="h-3.5 w-3.5" /></span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-black uppercase">{currentUser?.name || 'Ball Knower'}</div>
        <div className="mt-1 truncate text-[10px] font-bold text-zinc-500">{currentUser?.email || 'Guest account'}</div>
        <button type="button" onClick={() => setActionsOpen(true)} className="mt-3 min-h-10 rounded-xl border border-white/10 px-4 text-[9px] font-black uppercase text-zinc-200">{hasPhoto ? 'Change Photo' : 'Add Photo'}</button>
      </div>
    </section>

    <input ref={cameraInputRef} type="file" accept={ACCEPTED_PHOTOS} capture="user" className="sr-only" onChange={event => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
    <input ref={libraryInputRef} type="file" accept={ACCEPTED_PHOTOS} className="sr-only" onChange={event => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />

    {actionsOpen && <ModalPortal><div className="fixed inset-0 z-[9999] flex items-end bg-black/75 pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={() => !busy && setActionsOpen(false)}><section role="dialog" aria-modal="true" aria-label="Profile photo actions" className="w-full rounded-t-3xl border border-white/10 bg-[#101318] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl" onClick={event => event.stopPropagation()}><header className="mb-3 flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-wider text-[var(--bk-team-accent)]">Account</div><h2 className="text-lg font-black uppercase">{hasPhoto ? 'Change Photo' : 'Add Profile Photo'}</h2></div><button aria-label="Close profile photo actions" disabled={busy} onClick={() => setActionsOpen(false)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10"><X className="h-5 w-5" /></button></header><div className="space-y-2"><button disabled={busy} onClick={() => cameraInputRef.current?.click()} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 text-left text-xs font-black uppercase"><Camera className="h-4 w-4 text-[var(--bk-team-accent)]" />Take Photo</button><button disabled={busy} onClick={() => libraryInputRef.current?.click()} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 text-left text-xs font-black uppercase"><ImagePlus className="h-4 w-4 text-[var(--bk-team-accent)]" />Choose From Photos</button>{hasPhoto && <button disabled={busy} onClick={() => void remove()} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 text-left text-xs font-black uppercase text-red-300">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Remove Photo</button>}</div>{error && <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs font-bold text-red-300">{error}</p>}</section></div></ModalPortal>}

    {file && <ModalPortal><div className="fixed inset-0 z-[10000] flex items-end bg-black/85 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md sm:items-center sm:justify-center sm:p-4"><section role="dialog" aria-modal="true" aria-label="Crop profile photo" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101318] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl"><header className="flex items-center justify-between"><div><div className="text-[9px] font-black uppercase tracking-wider text-[var(--bk-team-accent)]">Square crop</div><h2 className="text-lg font-black uppercase">Position Your Photo</h2></div><button aria-label="Cancel profile photo edit" disabled={busy} onClick={closeEditor} className="grid h-11 w-11 place-items-center rounded-full border border-white/10"><X className="h-5 w-5" /></button></header><div className="mx-auto mt-4 aspect-square w-full max-w-[min(70vw,20rem)] overflow-hidden rounded-full border-2 border-[var(--bk-team-accent)]/50 bg-black"><canvas ref={previewCanvasRef} className="h-full w-full" /></div><div className="mt-5 space-y-4"><CropSlider label="Zoom" min={100} max={300} value={Math.round(crop.zoom * 100)} onChange={value => setCrop(current => ({ ...current, zoom: value / 100 }))} /><CropSlider label="Left / Right" min={0} max={100} value={crop.x} onChange={value => setCrop(current => ({ ...current, x: value }))} /><CropSlider label="Up / Down" min={0} max={100} value={crop.y} onChange={value => setCrop(current => ({ ...current, y: value }))} /></div>{error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs font-bold text-red-300">{error}</p>}<button disabled={busy} onClick={() => void save()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--bk-team-accent)] text-xs font-black uppercase text-[var(--bk-on-accent)] disabled:opacity-45">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Saving Photo…' : 'Save Photo'}</button><p className="mt-2 text-center text-[9px] font-bold text-zinc-600">Saved as a compressed 512 × 512 image.</p></section></div></ModalPortal>}
  </>;
};

const CropSlider = ({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (value: number) => void }) => <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-zinc-500">{label}</span><input aria-label={label} type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-[var(--bk-team-accent)]" /></label>;
