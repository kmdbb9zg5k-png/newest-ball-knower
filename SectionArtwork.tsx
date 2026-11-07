import React from 'react';
import './sectionArtwork.css';

const art={field:'/profile/cinematic/stadium-field.webp',trophy:'/profile/cinematic/trophy-vault.webp',film:'/community/arena-film-room-v1.webp',players:'/community/arena-circle-v1.webp',helmet:'/community/arena-h2h-v1.webp'};
/** Decorative photography; real titles, actions and records remain in the screen. */
export function SectionArtwork({kind,eyebrow,title,compact=false}:{kind:keyof typeof art;eyebrow?:string;title?:string;compact?:boolean}){
  return <div className={`bk-section-art${compact?' bk-section-art--compact':''}`} data-art-kind={kind}>
    <img src={art[kind]} alt="" loading="lazy" decoding="async" width={1280} height={720}/>
    {(eyebrow||title)&&<div className="bk-section-art-copy">{eyebrow&&<span>{eyebrow}</span>}{title&&<h2>{title}</h2>}</div>}
  </div>;
}
