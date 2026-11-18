import { lazy, Suspense, useState } from 'react';
import { practiceAsset, storeImage, type StoreProduct } from './storeCatalog';
import './profileAthleteShowcase.css';

const StoreCharacterPreview = lazy(() => import('./StoreCharacterPreview'));

export default function EquippedCharacterPreview({ character }: { character: StoreProduct }) {
  const [showModel, setShowModel] = useState(false);
  const model = practiceAsset(character);
  const look = character.showcase?.look ?? storeImage(character.id);
  const photo = <img className="bk-profile-character-photo" src={look} alt={character.name}/>;
  return <figure className="bk-profile-character-showcase">
    <figcaption>
      <strong>{character.name}</strong>
      {model && <button type="button" onClick={() => setShowModel(value => !value)}>
        {showModel ? 'View photo' : 'Preview in 3D'}
      </button>}
    </figcaption>
    {showModel && model ? <Suspense fallback={photo}>
      <StoreCharacterPreview name={character.name} model={model} look={look}/>
    </Suspense> : photo}
  </figure>;
}
