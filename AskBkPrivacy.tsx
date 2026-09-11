import React from 'react';

export function AskBkPrivacy(){
  return <section className="space-y-2" aria-label="Ask BK AI processing">
    <p><b>Ask BK:</b> Ball Knower does not save Ask BK conversations or screenshots in app storage or its database. The current session is held only in memory and clears when you leave the screen or tap Clear.</p>
    <p>To answer a question, the recent session messages, attached screenshots, and a limited snapshot of your active league and roster are sent through Vercel AI Gateway to a routed AI provider. Date-sensitive questions may use web search; generic NFL headlines may be retrieved from Tank01 without sending Tank01 your question or screenshots.</p>
    <p>Ball Knower requests zero-data-retention and no-training routing for Ask BK. Hosting, gateway, search, and AI services may still process limited security, billing, and operational metadata under their terms. Do not upload screenshots containing information you do not want processed for the answer.</p>
  </section>;
}
