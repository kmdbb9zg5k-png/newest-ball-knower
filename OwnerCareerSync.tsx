import React,{useEffect} from 'react';
import {League} from './types';
import {useBallKnower} from './BallKnowerContext';
import {rollupOwnerProfiles} from './spectatorCloud';

export const OwnerCareerSync:React.FC<{league:League}>=({league})=>{
 const {currentUser}=useBallKnower();
 useEffect(()=>{
  if(league.status!=='completed'||!league.seasonResult||currentUser?.id!==league.commissionerId)return;
  void rollupOwnerProfiles(league.id).catch(err=>console.warn('Owner career rollup failed',err?.message||err));
 },[league.id,league.status,league.seasonResult?.completedAt,currentUser?.id,league.commissionerId]);
 return null;
};
