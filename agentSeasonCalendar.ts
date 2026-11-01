import type {SeasonPhase} from "./agentTradeRules";

export type AgentCalendar = {seasonYear:number;seasonWeek:number;phase:SeasonPhase;simulatedDate:string};
const addDays=(iso:string,days:number)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};

/** Advance a playable week, skipping the quiet summer after offseason decisions. */
export function advanceAgentCalendar(calendar:AgentCalendar){
  let nextWeek = calendar.seasonWeek + 1;
  let nextYear = calendar.seasonYear;
  let nextPhase: SeasonPhase = calendar.phase;
  let nextDate = addDays(calendar.simulatedDate, 7);
  const events: string[] = [];

  if (calendar.phase === "preseason") {
    nextPhase = "regular";
    nextWeek = 1;
    events.push(`The ${nextYear} regular season has begun.`);
  } else if (calendar.phase === "regular" && nextWeek > 18) {
    nextPhase = "postseason";
    nextWeek = 1;
    events.push(
      "The regular season is over. Postseason and end-of-year contract decisions begin.",
    );
  } else if (calendar.phase === "postseason" && nextWeek > 5) {
    nextPhase = "offseason";
    nextWeek = 1;
    events.push(
      "The offseason has begun. Teams are preparing for the new league year.",
    );
  } else if (calendar.phase === "offseason" && nextWeek > 4) {
    nextYear += 1;
    nextPhase = "preseason";
    // The offseason is condensed into four decisions, not four real weeks.
    nextDate = `${nextYear}-09-03`;
    nextWeek = 0;
    events.push(
      `The ${nextYear} league year is open. Contract markets reset and every relationship matters again.`,
    );
  }

  return {nextWeek,nextYear,nextPhase,nextDate,events};
}
