import { ownerScenePath, type OwnerScene } from './ownerArtwork';
import './ownerArtwork.css';

/** Decorative scene illustrations; saved character portraits remain separate. */
export function OwnerArtwork({ scene, caption }: { scene: OwnerScene; caption?: string }) {
  return <div className="bk-owner-art" data-owner-scene={scene}>
    <img src={ownerScenePath(scene)} alt="" width={1280} height={720} loading="lazy" decoding="async" />
    {caption && <span>{caption}</span>}
  </div>;
}
