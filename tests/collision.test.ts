import test from 'node:test';
import assert from 'node:assert/strict';
import {circleIntersectsBox,createMotionGuard} from '../src/core/collision.ts';

const house={minX:5,maxX:10,minZ:5,maxZ:10};
test('circle hits house wall',()=>assert.equal(circleIntersectsBox(4.6,7,.6,house),true));
test('circle away from house does not hit',()=>assert.equal(circleIntersectsBox(0,0,.4,house),false));
test('circle exactly touching wall counts as collision',()=>assert.equal(circleIntersectsBox(4.5,7,.5,house),true));
test('movement inside bounds is allowed',()=>{
 const guard=createMotionGuard({minX:-20,maxX:20,minZ:-20,maxZ:20},[house]);
 assert.equal(guard(0,0,.4),true);
});
test('house and world edge block movement',()=>{
 const guard=createMotionGuard({minX:-20,maxX:20,minZ:-20,maxZ:20},[house]);
 assert.equal(guard(8,8,.5),false);
 assert.equal(guard(19.8,0,.5),false);
});
test('invalid position does not enter simulation',()=>{
 const guard=createMotionGuard({minX:-20,maxX:20,minZ:-20,maxZ:20},[]);
 assert.equal(guard(Number.NaN,0,.4),false);
 assert.equal(guard(0,0,-1),false);
});
