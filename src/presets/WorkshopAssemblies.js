import * as THREE from 'three';
import { Profile } from '../entities/Profile.js';
import { Plate } from '../entities/Plate.js';
import { Fastener, FASTENER_METRICS } from '../entities/Fastener.js';
import { getProfileData } from '../entities/ProfileCatalog.js';
import { buildSmartConnection, cutMemberToPlane } from '../core/SmartConnection.js';
import { boltLayout } from '../core/WorkshopGeometry.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const n=(v,f)=>Number.isFinite(Number(v))?Number(v):f;

export function baseAssembly(manager,ctx,x,z,options={}){
  const width=n(options.width,.4),t=n(options.thickness,.022),metric=options.metric||'M20',y=n(options.y,0),prefix=options.rolePrefix||'Base';
  const data=getProfileData('HEB',options.columnSize||'200'),m=FASTENER_METRICS[metric],edge=Math.max(1.5*m.holeD,35)/1000;
  if(width<data.b/1000+m.washerOD/1000+2*edge)throw new Error(`Placa base demasiado pequeña: aumente el lado a ${Math.ceil((data.b/1000+m.washerOD/1000+2*edge)*1000)} mm o más.`);
  const layout=boltLayout({width:width*1000,height:width*1000,diameter:m.d,edge:edge*1000,rows:2,cols:2});
  const plate=manager._plate(ctx,'base',width,width,t,prefix+' · placa',[x,y+t/2,z],[-Math.PI/2,0,0],{holes:layout.points.map(p=>({...p,diameter:m.holeD/1000}))});
  const anchors=layout.points.map((p,i)=>{const world=V(p.x,p.y,t/2).applyMatrix4(plate.mesh.matrixWorld);const anchor=manager._fastener(ctx,metric,`${prefix} · anclaje J ${i+1}`,world.toArray(),[0,1,0],'anchor',{shankLengthMm:n(options.embedmentMm,450),doubleNut:true});anchor.mesh.rotation.y=i%2?Math.PI:0;anchor.mesh.updateMatrixWorld(true);return anchor;});
  manager._registerBoltGroup(plate,anchors,{rows:2,cols:2,spacingX:layout.pitchX/1000,spacingY:layout.pitchY/1000,metric});
  if(options.stiffeners!==false){
    const reach=width/2-data.h/2000-.02,height=Math.min(.18,Math.max(.08,reach*1.5));
    for(const side of [-1,1])for(const half of [-1,1]){
      const p=new Plate('stiffener',reach,height,.01,{category:'stiffener',points:[{x:0,y:0},{x:reach,y:0},{x:0,y:height}]});
      const a=V(0,0,side),b=V(0,1,0),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a,b,a.clone().cross(b)));
      const turn=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),options.columnRotation||0),position=V(half*data.b*.0003,0,side*data.h/2000).applyQuaternion(turn).add(V(x,y+t,z));
      manager._add(ctx,p,`${prefix} · rigidizador ${side}/${half}`,position,q.premultiply(turn));
    }
  }
  return{plate,anchors};
}

function addJoint(manager,ctx,column,beam,options={}){
  const result=buildSmartConnection(column,beam,options);
  result.parts.forEach(p=>{manager.sceneManager.addObject(p);ctx.created.push(p);});
  return result;
}

function ridge(manager,ctx,left,right,height,size){
  const data=getProfileData('IPE',size),t=.02,edge=.04;
  const tangent=V(0,0,1).transformDirection(left.mesh.matrixWorld),depth=data.h/1000/Math.abs(tangent.x),haunch=data.h*.00055;
  const width=Math.max(data.b/1000+.08,.24),h=depth+2*edge+haunch;
  const layout=boltLayout({width:width*1000,height:h*1000,diameter:20,rows:4,cols:2,edge:40});
  const plates=[];
  for(const [side,beam,index]of[[-1,left,1],[1,right,0]]){
    const face=V(side*t,height,0),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(V(1,0,0),face);
    const cut=cutMemberToPlane(beam,index,plane);
    const plate=manager._plate(ctx,'endplate',width,h,t,'Testa de cumbrera '+(side<0?'izquierda':'derecha'),[side*t/2,height-haunch/2,0],[0,Math.PI/2,0],{holes:layout.points.map(p=>({...p,diameter:.022}))});plates.push(plate);
    // Three vertices follow the underside of the rafter and the vertical end plane.
    const up=V(0,1,0).transformDirection(beam.mesh.matrixWorld),away=V(0,0,index===1?-1:1).transformDirection(beam.mesh.matrixWorld);
    const bottom=cut.clone().addScaledVector(up,-data.h/2000);bottom.addScaledVector(away,-plane.distanceToPoint(bottom)/plane.normal.dot(away));
    const shift=plane.normal.dot(up)*haunch/plane.normal.dot(away),gusset=new Plate('gusset-custom',data.h*.0015,haunch,data.tw/1000,{points:[{x:0,y:0},{x:data.h*.0015,y:0},{x:shift,y:-haunch}]});
    manager._add(ctx,gusset,'Cartela de cumbrera '+(side<0?'izquierda':'derecha'),bottom,new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(away,up,away.clone().cross(up))));
  }
  const m=FASTENER_METRICS.M20,stack=(m.nutH+m.washerT)/1000;
  const bolts=layout.points.map((p,i)=>manager._fastener(ctx,'M20',`Tornillo de cumbrera ${i+1}`,[-t-stack,height-haunch/2+p.y,-p.x],[1,0,0],'bolt',{assemblyMode:'through-bolt',shankLengthMm:2*t*1000+m.nutH+2*m.washerT}));
  manager._registerBoltGroup(plates[1],bolts,{rows:4,cols:2,spacingX:layout.pitchX/1000,spacingY:layout.pitchY/1000,metric:'M20'});
}

export function portal(manager,ctx,sloped=true){
  const p=ctx.raw,span=Math.max(2,n(p.span,sloped?12:8)),height=Math.max(2,n(p.height,sloped?6:4)),slope=sloped?Math.max(0,n(p.slope,15))/100:0;
  const cs=manager._validSize('HEB',p.columnSize,sloped?'300':'240'),bs=manager._validSize('IPE',p.beamSize,sloped?'330':'300'),cd=getProfileData('HEB',cs),bd=getProfileData('IPE',bs);
  const half=cd.h/2000,t=.025,eaves=height-bd.h/2000*Math.sqrt(1+slope*slope)-.045-(half+.02)*slope,peak=eaves+span/2*slope;
  const columns=[];
  for(const side of [-1,1]){
    const c=new Profile('HEB',cs,height-t,'column');c.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),Math.PI/2));
    manager._add(ctx,c,side<0?'Pilar izquierdo':'Pilar derecho',V(side*span/2,(height+t)/2,0));columns.push(c);
    baseAssembly(manager,ctx,side*span/2,0,{width:Math.max(.42,cd.b/1000+.15),thickness:t,metric:'M24',columnSize:cs,columnRotation:Math.PI/2,rolePrefix:side<0?'Base izquierda':'Base derecha'});
  }
  if(sloped){
    const left=manager._member(ctx,[-span/2+half,eaves+half*slope,0],[0,peak,0],'IPE',bs,'Dintel izquierdo');
    const right=manager._member(ctx,[0,peak,0],[span/2-half,eaves+half*slope,0],'IPE',bs,'Dintel derecho');
    // Set a stable out-of-plane width direction for both inclined members.
    for(const beam of[left,right]){const axis=V(0,0,1).transformDirection(beam.mesh.matrixWorld),x=V(0,0,-1),up=axis.clone().cross(x);beam.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,axis));beam.mesh.updateMatrixWorld(true);}
    addJoint(manager,ctx,columns[0],left);addJoint(manager,ctx,columns[1],right);ridge(manager,ctx,left,right,peak,bs);
  }else{
    const beam=manager._member(ctx,[-span/2+half,eaves,0],[span/2-half,eaves,0],'IPE',bs,'Viga de pórtico');
    addJoint(manager,ctx,columns[0],beam,{haunch:false});addJoint(manager,ctx,columns[1],beam,{haunch:false});
  }
}

export function truss(manager,ctx){
  const p=ctx.raw,span=Math.max(2,n(p.span,12)),depth=Math.max(.4,n(p.height,2.4)),panels=Math.max(2,Math.min(16,Math.round(n(p.panels,6))));
  const series=p.series==='L'?'L':'SHS',size=manager._validSize(series,p.size,series==='L'?'80x8':'100x100x5'),data=getProfileData(series,size),width=(data.b||data.a)/1000,height=(data.h||data.a)/1000;
  const heel=Math.max(.45,depth*.22),dx=span/panels,bottom=[],top=[],members=[],nodes=[];
  for(let i=0;i<=panels;i++){const x=-span/2+i*dx;bottom.push(V(x,0,0));top.push(V(x,heel+(depth-heel)*(1-Math.abs(2*x/span)),0));}
  const add=(a,b,role)=>{members.push({a,b,role});};
  for(let i=0;i<panels;i++){add(bottom[i],bottom[i+1],`Cordón inferior ${i+1}`);add(top[i],top[i+1],`Cordón superior ${i+1}`);}
  for(let i=0;i<=panels;i++)add(bottom[i],top[i],`Montante ${i+1}`);
  for(let i=0;i<panels;i++){let a,b;if(p.trussType==='Warren')[a,b]=i%2?[top[i],bottom[i+1]]:[bottom[i],top[i+1]];else [a,b]=i<panels/2?[top[i],bottom[i+1]]:[bottom[i],top[i+1]];add(a,b,`Diagonal ${i+1}`);}
  for(const point of[...bottom,...top]){
    const dirs=members.filter(m=>m.a===point||m.b===point).map(m=>(m.a===point?m.b:m.a).clone().sub(point).normalize());
    let radius=height;
    for(let i=0;i<dirs.length;i++)for(let j=0;j<i;j++){const angle=Math.acos(THREE.MathUtils.clamp(dirs[i].dot(dirs[j]),-1,1));radius=Math.max(radius,height/2/Math.max(.1,Math.sin(angle/2))+.005);}
    nodes.push({point,radius});
  }
  for(const m of members){const dir=m.b.clone().sub(m.a).normalize(),ra=nodes.find(x=>x.point===m.a).radius,rb=nodes.find(x=>x.point===m.b).radius;if(ra+rb>=m.a.distanceTo(m.b)-.04)throw new Error('Los perfiles son demasiado grandes para estos paneles. Aumente la luz o reduzca la sección.');const beam=manager._member(ctx,m.a.clone().addScaledVector(dir,ra).toArray(),m.b.clone().addScaledVector(dir,-rb).toArray(),series,size,m.role);const x=V(0,0,1),y=dir.clone().cross(x);beam.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,dir));beam.mesh.updateMatrixWorld(true);}
  nodes.forEach(({point,radius},i)=>{
    const extent=radius+height+.03;let polygon=[[-extent,-extent],[extent,-extent],[extent,extent],[-extent,extent]].map(([x,y])=>({x:x+point.x,y:y+point.y}));
    // Trim neighbouring gussets at the bisector with a 2 mm assembly gap.
    for(const other of nodes){if(other.point===point)continue;const delta=other.point.clone().sub(point),distance=delta.length(),normal=delta.divideScalar(distance),limit=normal.dot(point)+distance/2-.001,result=[];
      for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],da=a.x*normal.x+a.y*normal.y-limit,db=b.x*normal.x+b.y*normal.y-limit;if(da<=0)result.push(a);if((da<0)!==(db<0)){const t=da/(da-db);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}polygon=result;
    }
    for(const side of[-1,1])manager._plate(ctx,'gusset-custom',2*extent,2*extent,.01,`Cartela de nudo ${i+1} · ${side<0?'posterior':'frontal'}`,[point.x,point.y,side*(width/2+.005)],[0,0,0],{points:polygon.map(p=>({x:p.x-point.x,y:p.y-point.y}))});
  });
}

export function expansionJoint(manager,ctx){
  const p=ctx.raw,span=Math.max(2,n(p.span,6)),height=Math.max(2,n(p.height,4)),gap=Math.max(.025,n(p.gap,.08)),cs=manager._validSize('HEB',p.columnSize,'200'),bs=manager._validSize('IPE',p.beamSize,'270'),cd=getProfileData('HEB',cs),bd=getProfileData('IPE',bs),offset=(cd.h/1000+gap)/2;
  // Common foundation head plate; the movement joint remains in the superstructure.
  for(const x of[-span/2,span/2])manager._plate(ctx,'base',cd.b/1000+.18,2*offset+cd.h/1000+.12,.024,'Placa de apoyo común',[x,.012,0],[-Math.PI/2,0,0]);
  for(const side of[-1,1]){
    const z=side*offset,label=side<0?'Alineación A':'Alineación B';
    for(const x of[-span/2,span/2]){
      manager._member(ctx,[x,.024,z],[x,height,z],'HEB',cs,label+' · pilar');
      manager._plate(ctx,'base',cd.b/1000+.02,cd.h/1000,.02,label+' · chapa de cabeza',[x,height+.01,z],[-Math.PI/2,0,0]);
      manager._plate(ctx,'neoprene',cd.b/1000,Math.min(bd.b,cd.h)/1000,.01,label+' · apoyo deslizante',[x,height+.025,z],[-Math.PI/2,0,0]);
    }
    manager._member(ctx,[-span/2-cd.b/2000,height+.03+bd.h/2000,z],[span/2+cd.b/2000,height+.03+bd.h/2000,z],'IPE',bs,label+' · viga independiente');
  }
}

export function steelDeck(manager,ctx){
  const p=ctx.raw,width=Math.max(1,n(p.width,3)),length=Math.max(2,n(p.length,6)),ribs=Math.max(2,Math.min(12,Math.round(n(p.ribs,6)))),depth=Math.max(.04,n(p.deckHeight,.075)),gauge=.0012,bs=manager._validSize('IPE',p.beamSize,'240'),bd=getProfileData('IPE',bs),deckY=2.6,top=deckY-gauge/2;
  const sheet=manager._plate(ctx,'folded',width,length,gauge,'Chapa grecada continua',[0,deckY,0],[0,0,0],{ribs,foldDepth:depth,category:'floor'});
  // Beams cross the ribs. Studs sit on troughs directly above the supporting flange.
  for(const z of[-length*.3,length*.3]){
    manager._member(ctx,[-width/2,top-bd.h/2000,z],[width/2,top-bd.h/2000,z],'IPE',bs,'Viga de apoyo del forjado');
    for(let i=0;i<ribs;i++){const x=-width/2+(i+.09)*width/ribs;manager._fastener(ctx,p.metric||'M20',`Conector en valle ${i+1}`,[x,deckY+gauge/2,z],[0,1,0],'stud',{shankLengthMm:100});}
  }
  return sheet;
}

export function castellated(manager,ctx){
  const p=ctx.raw,span=Math.max(2.5,n(p.span,7)),support=Math.max(1,n(p.supportHeight,3.2)),depth=Math.max(.28,Math.min(1.2,n(p.beamDepth,.5))),count=Math.max(3,Math.min(14,Math.round(n(p.openingCount,7)))),cs=manager._validSize('HEB',p.columnSize,'240'),cd=getProfileData('HEB',cs);
  const width=Math.max(.16,Math.min(.32,depth*.42)),tf=Math.max(.014,Math.min(.03,depth*.035)),tw=Math.max(.008,Math.min(.018,depth*.018)),pitch=span/(count+1),rx=Math.min(pitch*.34,depth*.38),ry=depth*.3,holes=[];
  for(let i=1;i<=count;i++){const x=-span/2+i*pitch;holes.push({points:[{x:x-rx,y:0},{x:x-rx/2,y:ry},{x:x+rx/2,y:ry},{x:x+rx,y:0},{x:x+rx/2,y:-ry},{x:x-rx/2,y:-ry}]});}
  const cy=support+.02+depth/2;
  for(const x of[-span/2,span/2]){manager._member(ctx,[x,0,0],[x,support,0],'HEB',cs,'Pilar de apoyo');manager._plate(ctx,'base',cd.b/1000+.04,cd.h/1000+.02,.02,'Chapa de reparto',[x,support+.01,0],[-Math.PI/2,0,0]);}
  manager._plate(ctx,'gusset-square',span+cd.b/1000,depth-2*tf,tw,'Alma alveolar perforada',[0,cy,0],[0,0,0],{holes});
  for(const side of[-1,1])manager._plate(ctx,'gusset-square',span+cd.b/1000,width,tf,side>0?'Ala superior armada':'Ala inferior armada',[0,cy+side*(depth/2-tf/2),0],[-Math.PI/2,0,0]);
  for(const x of[-span/2,span/2])for(const side of[-1,1])manager._plate(ctx,'gusset-square',(width-tw)/2,depth-2*tf,.012,'Rigidizador de apoyo',[x,cy,side*(width+tw)/4],[0,Math.PI/2,0],{category:'stiffener'});
}

export function doubleCleat(manager,ctx){
  const metric=ctx.raw.metric||'M16',m=FASTENER_METRICS[metric],height=Math.max(.22,n(ctx.raw.cleatHeight,.22)),t=.008,by=2.2,cd=getProfileData('HEB','240'),bd=getProfileData('IPE','270'),face=cd.h/2000,tw=bd.tw/1000,width=.18,leg=.11,ys=[-height/2+.04,height/2-.04],xs=[.065,.135],hole=m.holeD/1000;
  const c=new Profile('HEB','240',3,'column');c.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0,1,0),Math.PI/2));manager._add(ctx,c,'Pilar soporte',V(0,1.5,0));
  const beam=manager._member(ctx,[face+t+.01,by,0],[3.2,by,0],'IPE','270','Viga con unión de alma'),webHoles=[];
  for(const x of xs)for(const y of ys){const local=beam.mesh.worldToLocal(V(face+x,by+y,0));webHoles.push({y:local.y,z:local.z,radius:hole/2});}
  beam.update({webDrillings:webHoles});
  const plates=[];
  for(const side of[-1,1]){
    const legXHoles=xs.flatMap(x=>ys.map(y=>({x:x-width/2,y,diameter:hole}))),legZHoles=ys.map(y=>({x:0,y,diameter:hole}));
    const plate=manager._plate(ctx,'cleat',width,height,t,side>0?'Casquillo frontal':'Casquillo posterior',[face+t/2,by,side*(tw/2+t/2)],[side<0?Math.PI:0,0,0],{legDepth:leg,legXHoles,legZHoles});plates.push(plate);
  }
  const stack=(m.nutH+m.washerT)/1000,grip=tw+2*t;
  const beamBolts=xs.flatMap((x,i)=>ys.map((y,j)=>manager._fastener(ctx,metric,`Tornillo de alma ${i+1}.${j+1}`,[face+x,by+y,-grip/2-stack],[0,0,1],'bolt',{assemblyMode:'through-bolt',shankLengthMm:grip*1000+m.nutH+2*m.washerT})));
  manager._registerBoltGroup(plates[1],beamBolts,{rows:2,cols:2,spacingX:xs[1]-xs[0],spacingY:ys[1]-ys[0],metric});
  const drills=[];
  for(const side of[-1,1])for(const y of ys){const z=side*(tw/2+leg/2),point=V(face,by+y,z),local=c.mesh.worldToLocal(point.clone());drills.push({side:Math.sign(local.y),x:local.x,z:local.z,radius:hole/2});manager._fastener(ctx,metric,'Tornillo de ala del pilar',[face-cd.tf/1000-stack,by+y,z],[1,0,0],'bolt',{assemblyMode:'through-bolt',shankLengthMm:cd.tf+t*1000+m.nutH+2*m.washerT});}
  c.update({drillings:drills});
}

export function bracedBay(manager,ctx){
  portal(manager,ctx,false);
  const p=ctx.raw,span=Math.max(2,n(p.span,8)),height=Math.max(2,n(p.height,4)),cs=manager._validSize('HEB',p.columnSize,'240'),cd=getProfileData('HEB',cs),size=manager._validSize('CHS',p.braceSize,'76.1x3.6'),d=getProfileData('CHS',size).d/1000,r=d/2;
  const left=-span/2+cd.h/2000,right=span/2-cd.h/2000,low=.42,high=height-.65,slot=.2,thickness=.012;
  for(const side of[-1,1]){
    const z=side*(r+.007),a=V(left+.13,side<0?low:high,z),b=V(right-.13,side<0?high:low,z),dir=b.clone().sub(a).normalize();
    const tube=manager._member(ctx,a.toArray(),b.toArray(),'CHS',size,side<0?'Diagonal ascendente':'Diagonal descendente');const x=V(0,0,1),y=dir.clone().cross(x);tube.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,dir));tube.update({endSlots:{width:thickness+.001,depth:slot}});tube.mesh.updateMatrixWorld(true);
    for(const[point,inward,columnX]of[[a,dir,left],[b,dir.clone().negate(),right]]){
      const tip=point.clone().addScaledVector(inward,slot-.002),reach=Math.abs(tip.x-columnX),heightPlate=.28;
      const points=[{x:columnX-point.x,y:-heightPlate/2},{x:tip.x-point.x,y:tip.y-point.y},{x:columnX-point.x,y:heightPlate/2}];
      manager._plate(ctx,'gusset-custom',reach,heightPlate,thickness,'Cartela ranurada de diagonal',[point.x,point.y,z],[0,0,0],{points});
    }
  }
}
