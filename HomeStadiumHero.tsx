import React, {useState} from 'react';


/** Static artwork; navigation remains in the app below. */
export function HomeStadiumHero() {
  const [failed,setFailed]=useState(false);
  return <section className={`bk-home-stadium bk-home-legacy-hero${failed?' bk-home-legacy-fallback':''}`} aria-labelledby="home-stadium-title" data-motion="off">
    <div className="bk-home-legacy-frame">
    {!failed&&<img className="bk-home-legacy-art" src="/atmosphere/ball-knower-legacy-hero.webp" alt="" width="1354" height="1162" fetchPriority="high" decoding="async" draggable={false} onError={()=>setFailed(true)}/>}
    <div className={failed?'bk-home-legacy-fallback-copy':'sr-only'}>
      <p>Ball Knower. Your game. Your legacy.</p>
      <h2 id="home-stadium-title">Know ball. Play ball. Build your legacy.</h2>
      <p>Run your league. Build your franchise. Prove it on the field.</p>
    </div>
    </div>
  </section>;
}
