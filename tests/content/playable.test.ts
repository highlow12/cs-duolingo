import { describe, expect, it } from 'vitest';
import { compileContent } from '../../scripts/content/compiler';
import { loadSourceContent } from '../../scripts/content/model';
import { canonicalAnswer, evaluateQuestion } from '../../src/lib/questions/registry';
import type { Question, UserAnswer } from '../../src/lib/questions/types';
describe('shipped curriculum',()=>{
  it('has a valid playable canonical answer for every shipped question',async()=>{
    const compiled=compileContent(await loadSourceContent(process.cwd()));
    const types=new Set<string>();
    for(const raw of compiled.questions.values()){
      const question=raw as Question;types.add(question.type);
      const answer=canonicalAnswer(question);
      expect(answer,question.id).not.toBeNull();
      expect(evaluateQuestion(question,answer as UserAnswer),question.id).toEqual({status:'evaluated',result:{correct:true,score:1}});
    }
    expect(types.size).toBe(7);
  });
});
