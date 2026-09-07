import React from 'react';

export const AI_PHOTO_CONSENT_VERSION = '2026-09-06-v1';
export function AiPhotoPrivacy() {
  return <section className="space-y-2" aria-label="Optional AI photo processing">
    <p><b>Optional AI player portraits:</b> only after you give permission and request a render, Ball Knower sends your selected selfie, appearance description, position, jersey number and body settings to Google Gemini to generate an image. Choosing a selfie alone does not send it to Google.</p>
    <p>The request disables stored Gemini conversation history. This is not a promise of zero retention: Google's service, security and legal retention rules still apply. Your selected photo and generated image are also saved with your Ball Knower player progress. Contact support about removal or use account deletion for account-linked data.</p>
    <p>You can decline or untick permission and use the non-AI creator. <a className="underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Google Gemini terms</a> · <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google privacy policy</a></p>
  </section>;
}
export function AiPhotoConsent({ checked, onChange, disabled }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <div className="mt-4 space-y-3 rounded-2xl border border-white/15 bg-black/30 p-4 text-xs leading-5 text-zinc-300">
    <AiPhotoPrivacy/>
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0"/>
      <span>I am 18 or older, have permission to use this photo, and agree to send these inputs to Google Gemini for this optional render.</span>
    </label>
  </div>;
}
