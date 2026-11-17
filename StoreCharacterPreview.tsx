import { useEffect, useRef, useState } from 'react';
import { ACESFilmicToneMapping, Box3, Color, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './bkf-pose.css';

// Each product owns its recovered model; no career data or saved athlete is read.
export default function StoreCharacterPreview({ name, model, look }: { name: string; model: string; look: string }) {
  const host = useRef<HTMLDivElement>(null);
  const turn = useRef<Group | null>(null);
  const render = useRef(() => {});
  const drag = useRef<{ x: number; start: number } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    let stopped = false;
    let renderer: WebGLRenderer;
    let root: Group | null = null;
    setState('loading');
    const disposeModel = (object: Group) => {
      const textures = new Set<any>();
      object.traverse((mesh: any) => {
        mesh.geometry?.dispose();
        for (const material of mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) {
          for (const value of Object.values(material) as any[]) if (value?.isTexture) textures.add(value);
          material.dispose();
        }
      });
      textures.forEach(texture => { texture.dispose(); texture.image?.close?.(); });
    };
    try { renderer = new WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' }); }
    catch { setState('failed'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);
    const scene = new Scene();
    scene.background = new Color('#171717');
    scene.add(new HemisphereLight(0xffffff, 0x67615b, 2));
    const key = new DirectionalLight(0xffead6, 2.6); key.position.set(-3, 4, 5); scene.add(key);
    const fill = new DirectionalLight(0xd8e8ff, 1.7); fill.position.set(4, 2, -3); scene.add(fill);
    const camera = new PerspectiveCamera(35, 1, .01, 100);
    const pivot = new Group(); scene.add(pivot); turn.current = pivot;
    let radius = .6;
    const paint = () => { if (!stopped && !renderer.getContext().isContextLost()) renderer.render(scene, camera); };
    render.current = paint;
    const resize = () => {
      camera.aspect = Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1);
      // Fit both height and the full horizontal orbit, including hats and hands.
      const halfFov = camera.fov * Math.PI / 360;
      camera.position.set(0, 0, Math.max(1.08 / Math.tan(halfFov), radius / (Math.tan(halfFov) * camera.aspect)) + radius);
      camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight, false); paint();
    };
    const lost = (event: Event) => { event.preventDefault(); if (!stopped) setState('failed'); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 90000);
    (async () => {
      try {
        const response = await fetch(model, { signal: controller.signal });
        if (!response.ok) throw new Error('Model unavailable');
        const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '/store/');
        if (stopped) { disposeModel(gltf.scene); return; }
        root = gltf.scene;
        const size = new Box3().setFromObject(root).getSize(new Vector3());
        if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Invalid model');
        root.scale.multiplyScalar(1.9 / size.y);
        root.position.sub(new Box3().setFromObject(root).getCenter(new Vector3()));
        radius = Math.max(.4, Math.hypot(size.x, size.z) * 1.9 / size.y / 2);
        // Keep all geometry/UVs. Cap decoded texture memory for mobile GPUs.
        const seen = new Set<any>();
        root.traverse((mesh: any) => {
          for (const material of mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) {
            for (const texture of Object.values(material) as any[]) {
              if (!texture?.isTexture || seen.has(texture)) continue;
              seen.add(texture);
              const source = texture.image;
              if (source && Math.max(source.width, source.height) > 2048) {
                const scale = 2048 / Math.max(source.width, source.height);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale);
                const ctx = canvas.getContext('2d');
                if (ctx) { ctx.drawImage(source, 0, 0, canvas.width, canvas.height); texture.image = canvas; source.close?.(); texture.needsUpdate = true; }
              }
            }
          }
        });
        pivot.add(root); resize(); setState('ready');
      } catch { if (!stopped) setState('failed'); }
      finally { clearTimeout(timer); }
    })();
    return () => {
      stopped = true; controller.abort(); clearTimeout(timer); observer.disconnect();
      drag.current = null; turn.current = null; render.current = () => {};
      if (root) disposeModel(root);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [model, attempt]);
  const rotate = (amount: number) => { if (turn.current) { turn.current.rotation.y += amount; render.current(); } };
  return <div className="bkf-pose bkf-character" data-character-model={model} data-render-state={state}>
    <div ref={host} className="bkf-pose-stage" role="img" aria-label={`${name} standing 3D character. Drag to rotate.`}
      onPointerDown={event => { if (state !== 'ready' || !turn.current) return; drag.current = { x: event.clientX, start: turn.current.rotation.y }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (drag.current && turn.current) { turn.current.rotation.y = drag.current.start + (event.clientX - drag.current.x) * .012; render.current(); } }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}/>
    {state === 'loading' && <p className="bkf-pose-loading" role="status">Loading {name}…</p>}
    {state === 'failed' && <div className="bkf-character-fallback" role="status"><img src={look} alt={`${name} realistic view`}/><p>3D preview couldn’t load. You can retry or view the photos.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry 3D</button></div>}
    <div className="bkf-pose-controls"><div role="group" aria-label="Rotate character">
      <button type="button" aria-label="Rotate left" disabled={state !== 'ready'} onClick={() => rotate(-Math.PI / 6)}>↶</button>
      <span>Drag to rotate · 360°</span>
      <button type="button" aria-label="Reset rotation" disabled={state !== 'ready'} onClick={() => { if (turn.current) { turn.current.rotation.y = 0; render.current(); } }}>Reset</button>
      <button type="button" aria-label="Rotate right" disabled={state !== 'ready'} onClick={() => rotate(Math.PI / 6)}>↷</button>
    </div></div>
  </div>;
}
