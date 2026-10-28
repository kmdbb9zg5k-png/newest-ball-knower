import React from 'react';
import {FACIAL_HAIR,HAIR_COLORS,HAIR_STYLES,SKIN_TONES,TATTOO_COVERAGE,TATTOO_STYLES,type AthleteAppearance} from './athleteAppearance';

type Props={value:AthleteAppearance;onChange:(appearance:AthleteAppearance)=>void};
const title=(value:string)=>value.replaceAll('-',' ').replace(/\b\w/g,letter=>letter.toUpperCase());

export default function AthleteAppearanceEditor({value,onChange}:Props){
  const set=<K extends keyof AthleteAppearance>(key:K,next:AthleteAppearance[K])=>onChange({...value,[key]:next});
  return <section className="bk-athlete-appearance" aria-label="Athlete appearance customization">
    <div className="bk-athlete-editor-heading"><span>APPEARANCE</span><small>LIVE PREVIEW</small></div>
    <fieldset><legend>Skin tone</legend><div className="bk-athlete-swatches">{SKIN_TONES.map(item=><button key={item.id} type="button" aria-label={item.label} aria-pressed={value.skinTone===item.id} onClick={()=>set('skinTone',item.id)}><i style={{background:item.color}}/><span>{item.label}</span></button>)}</div></fieldset>
    <fieldset><legend>Hairstyle</legend><div className="bk-athlete-choice-grid">{HAIR_STYLES.map(style=><button key={style} type="button" aria-pressed={value.hairStyle===style} onClick={()=>set('hairStyle',style)}>{title(style)}</button>)}</div></fieldset>
    <fieldset><legend>Hair color</legend><div className="bk-athlete-swatches bk-athlete-hair-swatches">{HAIR_COLORS.map(item=><button key={item.id} type="button" aria-label={item.label} aria-pressed={value.hairColor===item.id} onClick={()=>set('hairColor',item.id)}><i style={{background:item.color}}/><span>{item.label}</span></button>)}</div></fieldset>
    <fieldset><legend>Facial hair</legend><div className="bk-athlete-choice-grid">{FACIAL_HAIR.map(style=><button key={style} type="button" aria-pressed={value.facialHair===style} onClick={()=>set('facialHair',style)}>{title(style)}</button>)}</div></fieldset>
    <fieldset><legend>Tattoo coverage</legend><div className="bk-athlete-choice-grid">{TATTOO_COVERAGE.map(coverage=><button key={coverage} type="button" aria-pressed={value.tattooCoverage===coverage} onClick={()=>set('tattooCoverage',coverage)}>{title(coverage)}</button>)}</div></fieldset>
    {value.tattooCoverage!=='none'?<fieldset><legend>Tattoo style</legend><div className="bk-athlete-choice-grid">{TATTOO_STYLES.map(style=><button key={style} type="button" aria-pressed={value.tattooStyle===style} onClick={()=>set('tattooStyle',style)}>{title(style)}</button>)}</div></fieldset>:null}
  </section>;
}
