import {myPlayerScenePath,type MyPlayerScene} from './myPlayerArtwork';
import './myPlayerArtwork.css';
/** Decorative illustrations; the athlete renderer and named cast retain their saved identities. */
export function MyPlayerArtwork({scene}:{scene:MyPlayerScene}) {
 return <div className="bk-player-art" data-player-scene={scene}><img src={myPlayerScenePath(scene)} alt="" width={1280} height={720} loading="lazy" decoding="async"/></div>;
}
