import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { compileContent } from '../../scripts/content/compiler';
import { loadSourceContent } from '../../scripts/content/model';
import { QuestionHost } from '../../src/lib/questions/host';
import { canonicalAnswer } from '../../src/lib/questions/registry';
import { LearningDatabase } from '../../src/lib/storage/db';
import { LearningRepository } from '../../src/lib/storage/repositories/learning-repository';
import { advanceLesson, recordAnswer } from '../../src/lib/lesson/lesson-engine';
import { missingPrerequisites } from '../../src/lib/curriculum/progress';
import type { Lesson, Curriculum } from '../../src/lib/content/types';
import type { Question, UserAnswer } from '../../src/lib/questions/types';

describe('real authored lesson to saved progress and review',()=>{
  it('completes variables, reports the next Python prerequisite and reviews a prior mistake',async()=>{
    const compiled=compileContent(await loadSourceContent(process.cwd()));
    const lesson=compiled.lessons.get('py.variables') as Lesson;
    const name=`vertical-slice-${crypto.randomUUID()}`;
    let database=new LearningDatabase(name);
    let now=new Date('2026-09-06T12:00:00Z').getTime();
    let repository=new LearningRepository({database,clock:()=>now});
    let session=await repository.startLesson(lesson);
    const studied:Question[]=[];
    while(session.status==='active'){
      const step=lesson.flow[session.currentIndex];
      if(step.type==='question'){
        const question=compiled.questions.get(step.ref) as Question;studied.push(question);
        let firstWrong=false;
        const host=new QuestionHost(question,{onAttempt:async(attempt)=>{
          if(!attempt.final){firstWrong=true;return;}
          const correct=attempt.result.correct&&!firstWrong;
          await repository.saveAttempt({id:attempt.attemptId,question,correct,durationMs:attempt.durationMs,mode:'lesson'});
          session=recordAnswer(session,question.id,correct);
          await repository.saveSession(session);
        }});
        if(question.type==='single-choice'){
          host.setAnswer({type:'single-choice',optionId:question.options.find(o=>o.id!==question.correctOptionId)!.id});
          await host.submit();expect(host.state.phase).toBe('retry-feedback');
          expect((await repository.getSnapshot()).questionStates).toHaveLength(0);
          host.retry();expect(host.state.phase).toBe('answering');
        }
        host.setAnswer(canonicalAnswer(question) as UserAnswer);await host.submit();
        expect(host.state.phase).toBe('final-feedback');
      }
      session=advanceLesson(session,lesson);
      if(session.status==='completed')await repository.completeLesson(lesson,session);
      else await repository.saveSession(session);
    }
    database.close();database=new LearningDatabase(name);repository=new LearningRepository({database,clock:()=>now});
    const snapshot=await repository.getSnapshot();
    expect(snapshot.lessonStates.find(s=>s.lessonId===lesson.id)?.status).toBe('completed');
    expect(missingPrerequisites('py.types',compiled.curriculum as Curriculum,snapshot.lessonStates)).toEqual([]);
    expect(missingPrerequisites('py.conditionals',compiled.curriculum as Curriculum,snapshot.lessonStates)).toEqual(['py.io']);
    expect(snapshot.questionStates.find(s=>s.questionId===studied[0].id)?.incorrectCount).toBe(1);
    expect(snapshot.questionStates).toHaveLength(2);
    now=Math.max(...snapshot.questionStates.map(s=>s.nextReviewAt??now))+1;
    expect(await repository.getReviewQueue(studied,new Date(now))).toHaveLength(2);
    await repository.saveAttempt({id:crypto.randomUUID(),question:studied[0],correct:true,durationMs:100,mode:'review'});
    const events=await database.studyEvents.where('questionId').equals(studied[0].id).sortBy('clientSeq');
    expect(events.map(e=>e.rating)).toEqual(['again','good']);
    expect((await repository.getSnapshot()).lessonStates[0].status).toBe('completed');
    await database.delete();
  });
});
