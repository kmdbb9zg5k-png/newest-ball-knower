export function parseTriviaAnswers(value:unknown):string[]{
  if(!Array.isArray(value)||value.length!==4||!value.every(answer=>typeof answer==='string'&&answer.trim().length>0)){
    throw new Error('Trivia question data contains malformed answer choices.');
  }
  return value.map(answer=>answer.trim());
}
