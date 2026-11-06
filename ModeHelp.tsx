import React from 'react';
import { ModeGuide } from './ModeGuide';
import { MODE_HELP, type ModeHelpKey } from './modeHelpContent';

/** On-demand mode instructions share the same accessible dialog as onboarding. */
export function ModeHelp({ mode, autoOpen = false }: { mode: ModeHelpKey; autoOpen?: boolean }) {
  const content = MODE_HELP[mode];
  return <ModeGuide storageKey={`bk-help-${mode}-v1`} {...content} autoOpen={autoOpen} />;
}
