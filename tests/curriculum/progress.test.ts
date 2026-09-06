import { describe, expect, it } from 'vitest';
import { missingPrerequisites, lessonStatus } from '../../src/lib/curriculum/progress';
import type { Curriculum, Lesson } from '../../src/lib/content/types';
import type { LessonState } from '../../src/lib/learning/domain/states';
const curriculum:Curriculum={schemaVersion:1,tracks:[],nodes:[{lesson:'root',requires:[]},{lesson:'branch',requires:['root','other']}]};
const lesson={id:'branch'} as Lesson;
const completed=(id:string)=>({lessonId:id,status:'completed'}) as LessonState;
describe('curriculum prerequisites',()=>{
 it('requires every prerequisite and rejects absent nodes',()=>{expect(missingPrerequisites('branch',curriculum,[completed('root')])).toEqual(['other']);expect(missingPrerequisites('unknown',curriculum,[])).toEqual(['unknown']);});
 it('unlocks branches after completion and keeps completed lessons open',()=>{expect(lessonStatus(lesson,curriculum,[])).toBe('locked');expect(lessonStatus(lesson,curriculum,[completed('root'),completed('other')])).toBe('available');expect(lessonStatus(lesson,curriculum,[completed('branch')])).toBe('completed');});
});
