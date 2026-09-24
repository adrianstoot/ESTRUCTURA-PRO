import * as THREE from 'three';
import { BIMElement } from './BIMElement.js';
export class Reinforcement extends BIMElement {
  constructor(params={}){super('reinforcement',{diameterMm:10,length:3,category:'reinforcement',...params});this.color='#748b95';this.buildMesh();}
  buildMesh(){const p=this.params;if(p.points?.length)p.length=p.points.slice(1).reduce((sum,v,i)=>sum+new THREE.Vector3(...v).distanceTo(new THREE.Vector3(...p.points[i])),0);this.designation=`Armadura Ø${p.diameterMm} · ${(p.length*1000).toFixed(0)} mm`;const g=new THREE.Group();
    if(p.points?.length){for(let i=1;i<p.points.length;i++){const a=new THREE.Vector3(...p.points[i-1]),b=new THREE.Vector3(...p.points[i]),delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(p.diameterMm/2000,p.diameterMm/2000,delta.length(),8),this.createMaterial(this.color));mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(mesh);}}
    else {const mesh=new THREE.Mesh(new THREE.CylinderGeometry(p.diameterMm/2000,p.diameterMm/2000,p.length,8),this.createMaterial(this.color));mesh.rotation.x=Math.PI/2;g.add(mesh);}
    this.mesh=g;this._applyUserData();}
  update(params){Object.assign(this.params,params);this.updateMesh();}
}
