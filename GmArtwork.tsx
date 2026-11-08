import React from 'react';
import { gmSceneUrl, type GmScene } from './gmSceneArtwork';
import './gmArtwork.css';

/** Atmospheric scenes are decorative; the adjacent heading describes the actual event. */
export function GmArtwork({ scene }: { scene: GmScene }) {
  return <img className="bk-gm-artwork" data-gm-scene={scene} src={gmSceneUrl(scene)} alt="" aria-hidden="true" width={1280} height={720} loading="lazy" decoding="async" />;
}
