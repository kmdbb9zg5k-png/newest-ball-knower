export function parseTriviaAnswers(value:unknown):string[]{
  if(!Array.isArray(value)||value.length!==4||!value.every(answer=>typeof answer==='string'&&answer.trim().length>0)){
    throw new Error('Trivia question data contains malformed answer choices.');
  }
  const answers=value.map(answer=>answer.trim());
  if(new Set(answers.map(answer=>answer.toLowerCase())).size!==4)throw new Error('Trivia question data contains duplicate answer choices.');
  return answers;
}
