import test from 'node:test';
import assert from 'node:assert/strict';
import { nextCandidateBySourceRoundRobin } from '../../server/corpus/corpus-step-v376.mjs';

test('wide acquisition prefers a source with fewer processed reports',()=>{
  const job={
    candidates:['a1','a2','b1','b2','c1'],
    processedWide:['a1','b1'],
    failed:[],
    candidateSourceByCode:{a1:'guild:1',a2:'guild:1',b1:'guild:2',b2:'guild:2',c1:'guild:3'},
  };
  assert.equal(nextCandidateBySourceRoundRobin(job),'c1');
});

test('wide acquisition skips failed candidates without letting prolific sources jump the round',()=>{
  const job={
    candidates:['a1','a2','b1','b2','c1'],
    processedWide:['a1'],
    failed:[{stage:'wide',code:'c1'}],
    candidateSourceByCode:{a1:'guild:1',a2:'guild:1',b1:'guild:2',b2:'guild:2',c1:'guild:3'},
  };
  assert.equal(nextCandidateBySourceRoundRobin(job),'b1');
});

test('unmapped discovery seeds remain eligible but never count as canonical source identity',()=>{
  const job={candidates:['seedB','seedA'],processedWide:[],failed:[],candidateSourceByCode:{}};
  assert.equal(nextCandidateBySourceRoundRobin(job),'seedA');
});
