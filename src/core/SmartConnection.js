import * as THREE from 'three';
import { Plate } from '../entities/Plate.js';
import { Fastener, FASTENER_METRICS } from '../entities/Fastener.js';
import { getProfileData } from '../entities/ProfileCatalog.js';
import { memberEndpoints, boltLayout, mm } from './WorkshopGeometry.js';

const I_SERIES=['HEB','HEA','IPE'];
const axis=(x,y,z)=>new THREE.Vector3(x,y,z);
export function sectionFrame(object){object.mesh.updateWorldMatrix(true,true);const section=object.mesh.children.find(c=>c.name?.endsWith('sección'));return(section?.matrixWorld||object.mesh.matrixWorld).clone();}

// Keep the other end cut in world space while changing the member's centre.
export function cutMemberToPlane(beam,index,plane){
  const oldFrame=sectionFrame(beam),ends=memberEndpoints(beam),near=ends[index],far=ends[1-index],away=far.clone().sub(near).normalize();
  const denom=plane.normal.dot(away);if(Math.abs(denom)<.1)throw new Error('Plano casi paralelo al eje del perfil.');
  const cut=near.clone().addScaledVector(away,-plane.distanceToPoint(near)/denom);
  if(far.clone().sub(cut).dot(away)<.05)throw new Error('El corte dejaría el perfil sin longitud útil.');
  const oldCuts={};for(const key of ['endCutStart','endCutEnd'])if(beam.params[key]){const p=beam.params[key];oldCuts[key]=new THREE.Plane(new THREE.Vector3(...p.normal),p.constant).applyMatrix4(oldFrame);}
  beam.params.length=cut.distanceTo(far);beam.mesh.position.copy(cut).add(far).multiplyScalar(.5);beam.mesh.updateMatrixWorld(true);
  const inverse=sectionFrame(beam).invert();oldCuts[index===0?'endCutStart':'endCutEnd']=plane.clone();
  for(const[key,p]of Object.entries(oldCuts)){p.applyMatrix4(inverse);beam.params[key]={normal:p.normal.toArray(),constant:p.constant};}
  beam.update(beam.params);return cut;
}

export function findEncounter(column,beam,maxDistance=.35){
  if(!column||!beam||column===beam||column.type!=='profile'||beam.type!=='profile')return null;
  if(!I_SERIES.includes(column.params.series)||!I_SERIES.includes(beam.params.series))return null;
  const frame=sectionFrame(column),inverse=frame.clone().invert(),data=getProfileData(column.params.series,column.params.size);
  const ends=memberEndpoints(beam),local=ends.map(p=>p.clone().applyMatrix4(inverse));
  const direction=local[1].clone().sub(local[0]).normalize();
  if(Math.abs(direction.y)<.35 || Math.abs(direction.x)>.03)return null;
  const ranked=local.map((p,i)=>({point:p,index:i,side:Math.sign(p.y)||1,distance:Math.abs(Math.abs(p.y)-mm(data.h)/2)})).filter(c=>Math.abs(c.point.x)<mm(data.b)/2 && Math.abs(c.point.z)<column.params.length/2+.01).sort((a,b)=>a.distance-b.distance);
  const hit=ranked[0];return hit&&hit.distance<=maxDistance?{...hit,column,beam,frame,inverse,ends,data}:null;
}

export function buildSmartConnection(column,beam,options={}){
  if([column,beam].some(o=>o?.mesh.scale.distanceTo(axis(1,1,1))>1e-9))throw new Error('La unión necesita perfiles sin escala. Edite la sección y la longitud numéricamente.');
  const encounter=findEncounter(column,beam,options.maxDistance??.35);
  if(!encounter)throw new Error('Aproxime el extremo de una viga I/H al ala de un pilar I/H. Los ejes de ancho deben estar alineados.');
  const {frame,inverse,side,index,data:cd}=encounter,bd=getProfileData(beam.params.series,beam.params.size);
  const beamFrame=sectionFrame(beam),beamX=axis(1,0,0).transformDirection(beamFrame),columnX=axis(1,0,0).transformDirection(frame),beamUp=axis(0,1,0).transformDirection(beamFrame);
  if(Math.abs(beamX.dot(columnX))<.999)throw new Error('Alinee los ejes de ancho de la viga y del pilar antes de generar rigidizadores.');
  const thickness=mm(options.thicknessMm??20),clearance=mm(options.clearanceMm??.5),edge=options.edgeMm??40,diameter=options.diameter??20;
  if(![thickness,clearance,edge,diameter].every(Number.isFinite)||thickness<=0||clearance<0||clearance>.005)throw new Error('Espesor positivo y holgura entre 0 y 5 mm.');
  const normal=axis(0,side,0).transformDirection(frame),facePoint=encounter.point.clone();facePoint.y=side*mm(cd.h)/2;facePoint.applyMatrix4(frame);
  const planePoint=facePoint.clone().addScaledVector(normal,thickness),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,planePoint);
  const endpoints=memberEndpoints(beam),near=endpoints[index],far=endpoints[1-index],away=far.clone().sub(near).normalize();
  const denom=normal.dot(away);if(Math.abs(denom)<.35)throw new Error('Encuentro demasiado oblicuo para esta plantilla.');
  const cut=near.clone().addScaledVector(away,-plane.distanceToPoint(near)/denom);
  if(far.clone().sub(cut).dot(away)<.05)throw new Error('La chapa dejaría la viga sin longitud útil.');
  // True plane-cut end, including the sloped flanges: no overlapping square end.
  cutMemberToPlane(beam,index,plane);
  const id=options.id||`joint-${beam.id}-${column.id}`,parts=[];
  const cfg={...options,id,columnId:column.id,beamId:beam.id,thicknessMm:thickness*1000,clearanceMm:clearance*1000,edgeMm:edge,diameter};
  const add=(part,role)=>{part.params.assemblyId=id;part.params.role=role;part.params.smartJointKey=role;part.params.smartJointOwner=beam.id;part.params.provenance='Ajuste geométrico al perfil · dimensiones editables · TALLER-01';part._applyUserData();parts.push(part);return part;};
  const columnZ=axis(0,0,1).transformDirection(frame);
  const cos=Math.abs(beamUp.dot(columnZ));if(cos<.35)throw new Error('Pendiente fuera del intervalo admitido.');
  const projectedDepth=bd.h/cos,haunch=options.haunch!==false?mm(bd.h*.55):0;
  const plateHeight=projectedDepth+2*edge+haunch*1000,plateWidth=Math.max(cd.b,bd.b+2*edge);
  const layout=boltLayout({width:plateWidth,height:plateHeight,diameter,edge,rows:options.rows??4,cols:2});
  const plate=new Plate('endplate',mm(plateWidth),mm(plateHeight),thickness,{holes:layout.points.map(p=>({...p,diameter:mm(layout.hole)})),boltGroup:{rows:options.rows??4,cols:2,metric:`M${diameter}`,rule:layout.rule,edgeMm:edge},category:'plate'});
  const plateY=columnZ.clone(),plateX=plateY.clone().cross(normal).normalize();
  plate.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(plateX,plateY,normal));
  plate.mesh.position.copy(facePoint).addScaledVector(normal,thickness/2).addScaledVector(columnZ,-haunch/2);plate.mesh.updateMatrixWorld(true);
  add(plate,'Chapa de testa ajustada');
  const bolts=[];
  for(const [i,p]of layout.points.entries()){
    const metric=FASTENER_METRICS[`M${diameter}`];
    if(!metric)throw new Error('Métrica no disponible.');
    const grip=thickness+mm(cd.tf),stack=mm(metric.nutH+metric.washerT);
    const f=new Fastener('bolt',`M${diameter}`,(grip+stack+mm(metric.washerT))*1000,{assemblyMode:'through-bolt'});
    f.params.hostPlateId=plate.id;f.params.boltClass=options.boltClass||'8.8';
    f.mesh.quaternion.setFromUnitVectors(axis(0,1,0),normal);
    f.mesh.position.copy(axis(p.x,p.y,-thickness/2-mm(cd.tf)-stack).applyMatrix4(plate.mesh.matrixWorld));f.mesh.updateMatrixWorld(true);
    add(f,`Tornillo de testa ${i+1}`);bolts.push(f);
  }
  plate.params.boltGroup.boltIds=bolts.map(b=>b.id);
  // Drill the supporting flange at the exact axes of the generated bolts.
  const drillings=(column.params.drillings||[]).filter(d=>d.jointId!==id);
  for(const p of layout.points){const local=axis(p.x,p.y,0).applyMatrix4(plate.mesh.matrixWorld).applyMatrix4(inverse);if(Math.abs(local.x)+mm(layout.hole)/2>mm(cd.b)/2)throw new Error('Los taladros quedarían fuera del ala del pilar. Aumente el perfil o reduzca la matriz.');if(Math.abs(local.z)+mm(layout.hole)/2>column.params.length/2)throw new Error('Los taladros exceden el extremo del pilar. Desplace la viga o prolongue el pilar.');drillings.push({x:local.x,z:local.z,radius:mm(layout.hole)/2,side,jointId:id});}
  column.params.drillings=drillings;column.update(column.params);
  // Continuity plates follow the actual beam-flange planes, including roof slope.
  for(const flangeSide of [-1,1]){
    const flangePoint=cut.clone().addScaledVector(beamUp,flangeSide*mm(bd.h-bd.tf)/2);
    const nLocal=beamUp.clone().transformDirection(inverse),pointLocal=flangePoint.clone().applyMatrix4(inverse);
    const zAt=(x,y)=>pointLocal.z-(nLocal.x*(x-pointLocal.x)+nLocal.y*(y-pointLocal.y))/nLocal.z;
    const origin=axis(0,0,zAt(0,0)).applyMatrix4(frame),basisY=axis(0,1,-nLocal.y/nLocal.z).transformDirection(frame),basisN=columnX.clone().cross(basisY).normalize();
    const matrix=new THREE.Matrix4().makeBasis(columnX,basisY,basisN),q=new THREE.Quaternion().setFromRotationMatrix(matrix),toPlate=new THREE.Matrix4().compose(origin,q,axis(1,1,1)).invert();
    for(const half of [-1,1]){
      const inner=mm(cd.tw)/2+clearance,outer=mm(cd.b)/2-clearance,depth=mm(cd.h/2-cd.tf)-clearance-Math.abs(nLocal.y)*mm(options.stiffenerMm??bd.tf)/2,notch=mm(cd.r||0)+clearance;
      const xy=[[inner,-depth+notch],[inner+notch,-depth],[outer,-depth],[outer,depth],[inner+notch,depth],[inner,depth-notch]];
      const points=xy.map(([x,y])=>{x*=half;const p=axis(x,y,zAt(x,y)).applyMatrix4(frame).applyMatrix4(toPlate);return{x:p.x,y:p.y};});
      const stiffener=new Plate('stiffener',outer-inner,2*depth,mm(options.stiffenerMm??bd.tf),{points,nominalWidthMm:(cd.b-cd.tw)/2,category:'stiffener'});
      stiffener.mesh.position.copy(origin);stiffener.mesh.quaternion.copy(q);add(stiffener,`Rigidizador ${flangeSide>0?'superior':'inferior'} ${half>0?'derecho':'izquierdo'}`);
    }
  }
  if(haunch){
    const bottom=cut.clone().addScaledVector(beamUp,-mm(bd.h)/2);bottom.addScaledVector(away,-plane.distanceToPoint(bottom)/denom);
    const x2=normal.dot(beamUp)*haunch/denom,length=mm(bd.h*1.5),normalPlate=away.clone().cross(beamUp).normalize();
    const gusset=new Plate('gusset-custom',length,haunch,mm(options.haunchThicknessMm??bd.tw),{points:[{x:0,y:0},{x:length,y:0},{x:x2,y:-haunch}],category:'plate'});
    gusset.mesh.position.copy(bottom);gusset.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(away,beamUp,normalPlate));add(gusset,'Cartela de alero · ajuste de pendiente');
  }
  beam.params.smartJoint=cfg;beam.params.smartJoints=[...(beam.params.smartJoints||[]).filter(c=>c.id!==id),cfg];beam.params.assemblyId=id;column._applyUserData();beam._applyUserData();
  for(const part of parts)part.mesh.updateMatrixWorld(true);
  return {parts,config:cfg,nominalStiffenerWidthMm:(cd.b-cd.tw)/2,thicknessMm:options.stiffenerMm??bd.tf};
}
