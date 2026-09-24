import * as THREE from 'three';

const v=()=>new THREE.Vector3();
export function meshTriangles(object) {
  object.mesh.updateWorldMatrix(true,true);const triangles=[];
  object.mesh.traverseVisible(mesh=>{
    if(!mesh.isMesh||mesh.userData.ignoreSnap)return;
    const g=mesh.geometry,p=g.attributes.position,idx=g.index,count=idx?.count||p.count;
    for(let i=0;i<count;i+=3){const points=[0,1,2].map(j=>v().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));const t=new THREE.Triangle(...points);if(t.getArea()>1e-15)triangles.push(t);}
  });return triangles;
}
const bounds=triangles=>{const box=new THREE.Box3();for(const t of triangles){box.expandByPoint(t.a);box.expandByPoint(t.b);box.expandByPoint(t.c);}return box;};
function tree(triangles){const box=bounds(triangles);if(triangles.length<=8)return{box,triangles};const size=box.getSize(v()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';triangles.sort((a,b)=>(a.a[axis]+a.b[axis]+a.c[axis])-(b.a[axis]+b.b[axis]+b.c[axis]));const mid=Math.floor(triangles.length/2);return{box,left:tree(triangles.slice(0,mid)),right:tree(triangles.slice(mid))};}
function boxDistance(a,b){let d=0;for(const k of ['x','y','z']){const delta=Math.max(a.min[k]-b.max[k],b.min[k]-a.max[k],0);d+=delta*delta;}return d;}
function segmentDistance(p1,q1,p2,q2){const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),r=p1.clone().sub(p2),a=d1.dot(d1),e=d2.dot(d2),f=d2.dot(r);let s=0,t=0;const clamp=THREE.MathUtils.clamp;
  if(a<1e-20)t=clamp(f/e,0,1);else{const c=d1.dot(r);if(e<1e-20)s=clamp(-c/a,0,1);else{const b=d1.dot(d2),denom=a*e-b*b;s=denom?clamp((b*f-c*e)/denom,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}}}
  return[p1.clone().addScaledVector(d1,s),p2.clone().addScaledVector(d2,t)];
}
export function triangleDistance(a,b){let best={distanceSq:Infinity,a:null,b:null};const save=(p,q)=>{const d=p.distanceToSquared(q);if(d<best.distanceSq)best={distanceSq:d,a:p.clone(),b:q.clone()};};
  const pa=[a.a,a.b,a.c],pb=[b.a,b.b,b.c];
  for(let i=0;i<3;i++){save(pa[i],b.closestPointToPoint(pa[i],v()));save(a.closestPointToPoint(pb[i],v()),pb[i]);}
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)save(...segmentDistance(pa[i],pa[(i+1)%3],pb[j],pb[(j+1)%3]));
  for(const [points,t,flip] of [[pa,b,false],[pb,a,true]])for(let i=0;i<3;i++){const delta=points[(i+1)%3].clone().sub(points[i]),len=delta.length();if(len<1e-12)continue;const hit=new THREE.Ray(points[i],delta.divideScalar(len)).intersectTriangle(t.a,t.b,t.c,false,v());if(hit && hit.distanceTo(points[i])<=len+1e-10)save(hit,hit);}
  return best;
}
export function surfaceDistance(first,second){
  const ta=meshTriangles(first),tb=meshTriangles(second);if(!ta.length||!tb.length)return null;
  const a=tree(ta),b=tree(tb);let best={distanceSq:Infinity,a:null,b:null};
  function visit(x,y){if(boxDistance(x.box,y.box)>=best.distanceSq)return;if(x.triangles&&y.triangles){for(const p of x.triangles)for(const q of y.triangles){const r=triangleDistance(p,q);if(r.distanceSq<best.distanceSq)best=r;}return;}const pairs=x.triangles?[[x,y.left],[x,y.right]]:y.triangles?[[x.left,y],[x.right,y]]:[[x.left,y.left],[x.left,y.right],[x.right,y.left],[x.right,y.right]];pairs.sort((p,q)=>boxDistance(p[0].box,p[1].box)-boxDistance(q[0].box,q[1].box));for(const pair of pairs){if(best.distanceSq<1e-16)break;visit(...pair);}}
  visit(a,b);return{...best,distance:Math.sqrt(best.distanceSq)};
}
export function surfaceContacts(objects,point,tolerance=.001){const result=[];for(const object of objects){if(!object.mesh?.visible||object.type==='weld')continue;if(object.getBoundingBox().distanceToPoint(point)>tolerance)continue;for(const t of meshTriangles(object)){if(t.closestPointToPoint(point,v()).distanceTo(point)>tolerance)continue;const normal=t.getNormal(v());if(!result.some(r=>r.object===object&&Math.abs(r.normal.dot(normal))>.999))result.push({object,normal});}}return result;}

// A containment check avoids reporting a positive "clearance" for a piece
// completely embedded in another. Boundary points are not classified as inside.
export function pointInsideTriangles(point,triangles,tolerance=1e-6){
  if(triangles.some(t=>t.closestPointToPoint(point,v()).distanceTo(point)<=tolerance))return false;
  // Solid angle winding avoids parity errors from almost coincident ray hits
  // at fillets and triangulated hole boundaries. Requires closed mesh solids.
  let winding=0;
  for(const t of triangles){const a=t.a.clone().sub(point),b=t.b.clone().sub(point),c=t.c.clone().sub(point),la=a.length(),lb=b.length(),lc=c.length();winding+=2*Math.atan2(a.dot(b.clone().cross(c)),la*lb*lc+a.dot(b)*lc+b.dot(c)*la+c.dot(a)*lb);}
  return Math.abs(winding)>Math.PI*2;
}
export function solidRelation(first,second,tolerance=.0001){
  if(!first.getBoundingBox().expandByScalar(tolerance).intersectsBox(second.getBoundingBox()))return{kind:'separated'};
  const a=meshTriangles(first),b=meshTriangles(second),bb=bounds(b),ab=bounds(a);
  const solids=o=>{const list=[];o.mesh.traverseVisible(mesh=>{if(mesh.isMesh){const ts=meshTriangles({mesh});list.push({triangles:ts,box:bounds(ts)});}});return list;};
  for(const [source,target,box]of[[a,solids(second),bb],[b,solids(first),ab]]){
    const seen=new Set();
    for(const triangle of source){for(const p of[triangle.a,triangle.b,triangle.c,triangle.getMidpoint(v())]){
      if(!box.containsPoint(p))continue;const key=p.toArray().map(n=>Math.round(n*1e6)).join(',');if(seen.has(key))continue;seen.add(key);
      if(target.some(s=>s.box.containsPoint(p)&&pointInsideTriangles(p,s.triangles,tolerance)))return{kind:'penetration',point:p.clone()};
    }}
  }
  const result=surfaceDistance(first,second);return{kind:result?.distance<=tolerance?'contact':'separated',...result};
}
