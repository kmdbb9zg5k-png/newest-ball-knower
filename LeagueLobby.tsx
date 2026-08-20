import React from 'react';
import { League } from './types';
import { FantasyLeagueCommandCenter } from './FantasyLeagueCommandCenter';

interface LeagueLobbyProps {
  league: League;
  onGoToDraft: () => void;
  onGoToSimulation: () => void;
}

export const LeagueLobby: React.FC<LeagueLobbyProps> = ({ league, onGoToDraft, onGoToSimulation }) => (
  <FantasyLeagueCommandCenter league={league} onGoToDraft={onGoToDraft} onGoToSimulation={onGoToSimulation} />
);
