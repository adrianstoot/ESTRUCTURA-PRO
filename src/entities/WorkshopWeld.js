import * as THREE from 'three';
import { BIMElement } from './BIMElement.js';
import { applyWorkshopStyle } from '../core/WorkshopMaterial.js';
const vector=p=>p?.isVector3?p.clone():Array.isArray(p)?new THREE.Vector3(...p):new THREE.Vector3(p?.x||0,p?.y||0,p?.z||0);
export class Weld extends BIMElement {
  constructor(a,b,throat=.005,bindings=null){super('weld',{radius:throat,throat,renderStyle:'fillet'});this.pointA=vector(a);this.pointB=vector(b);this.color='#6c7d88';this.setBindings(bindings);this.buildMesh();}
  static fromState(s){const w=new Weld(s.pointA||s.endpoints?.a,s.pointB||s.endpoints?.b,s.throat??s.radius??.005,s.bindings);if(s.surfaceNormals)w.params.surfaceNormals=s.surfaceNormals;if(s.normalBindings)w.params.normalBindings=structuredClone(s.normalBindings);w._rebuild();return w;}
  setBindings(bindings){this.bindings={a:bindings?.a?structuredClone(bindings.a):null,b:bindings?.b?structuredClone(bindings.b):null};this.params.bindings=this.getSerializableBindings();}
  setBinding(endpoint,binding){this.bindings[endpoint]=binding;this.params.bindings=this.getSerializableBindings();}
  getSerializableBindings(){return JSON.parse(JSON.stringify(this.bindings));}
  serializeEndpoints(){return{pointA:this.pointA.toArray(),pointB:this.pointB.toArray(),radius:this.params.radius,throat:this.params.throat,bindings:this.getSerializableBindings(),surfaceNormals:this.params.surfaceNormals,normalBindings:this.params.normalBindings};}
  buildMesh(){this.mesh=new THREE.Group();this._rebuild();}
  setSectionNormals(a,b,owners=[]){this.params.surfaceNormals=[vector(a).toArray(),vector(b).toArray()];this.params.normalBindings=[a,b].map((n,i)=>{const o=owners[i];if(!o?.mesh)return null;o.mesh.updateWorldMatrix(true,true);return{objectId:o.id,localNormal:vector(n).transformDirection(o.mesh.matrixWorld.clone().invert()).toArray()};});this._rebuild();}
  _rebuild(){
    for(const c of [...this.mesh.children]){c.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});this.mesh.remove(c);}
    const len=this.pointA.distanceTo(this.pointB),t=this.pointB.clone().sub(this.pointA).normalize(),a=Math.max(.0001,this.params.throat||this.params.radius||.005);
    let x,z,angle=Math.PI/2;
    if(this.params.surfaceNormals){const [na,nb]=this.params.surfaceNormals.map(vector);x=t.clone().cross(na).normalize();if(x.dot(nb)<0)x.negate();const legB=nb.clone().cross(t).normalize();if(legB.dot(na)<0)legB.negate();angle=Math.acos(THREE.MathUtils.clamp(x.dot(legB),-.99,.99));z=x.clone().cross(t).normalize();if(z.dot(legB)<0){t.negate();z.negate();}}
    else {x=Math.abs(t.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);x.addScaledVector(t,-x.dot(t)).normalize();z=x.clone().cross(t).normalize();}
    const leg=a/Math.cos(angle/2),shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(leg,0);shape.lineTo(leg*Math.cos(angle),leg*Math.sin(angle));shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(len,.000001),bevelEnabled:false,steps:1});geometry.translate(0,0,-len/2);geometry.rotateX(Math.PI/2);
    // Shape x,y maps to cross-section x,z; extrusion maps to -y.
    const solid=new THREE.Mesh(geometry,this.createMaterial(this.color));this.mesh.add(solid);
    this.mesh.position.copy(this.pointA).add(this.pointB).multiplyScalar(.5);this.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,t,z));
    this.designation=`Soldadura a=${(a*1000).toFixed(1)} · L=${(len*1000).toFixed(1)} mm`;this.area=.5*leg*leg*Math.sin(angle)*1e4;this.mass=this.area/1e4*len*7850;
    this.params.pointA=this.pointA.toArray();this.params.pointB=this.pointB.toArray();this._applyUserData();this.mesh.updateMatrixWorld(true);applyWorkshopStyle(this);
  }
  update(p){Object.assign(this.params,p);this.params.throat=p.throat??p.radius??this.params.throat;this.params.radius=this.params.throat;this._rebuild();}
  setEndpoints(a,b){this.pointA=vector(a);this.pointB=vector(b);this._rebuild();}
  updateFromBindings(resolver){let changed=false;for(const key of ['a','b']){const binding=this.bindings[key],owner=binding&&resolver(binding.objectId);if(!owner?.mesh)continue;owner.mesh.updateWorldMatrix(true,true);const p=vector(binding.localPoint).applyMatrix4(owner.mesh.matrixWorld),target=key==='a'?this.pointA:this.pointB;if(p.distanceToSquared(target)>1e-18){target.copy(p);changed=true;}}this.params.normalBindings?.forEach((binding,i)=>{const owner=binding&&resolver(binding.objectId);if(!owner?.mesh)return;owner.mesh.updateWorldMatrix(true,true);const n=vector(binding.localNormal).transformDirection(owner.mesh.matrixWorld);if(n.distanceToSquared(vector(this.params.surfaceNormals[i]))>1e-18){this.params.surfaceNormals[i]=n.toArray();changed=true;}});if(changed)this._rebuild();return changed;}
  setPosition(x,y,z){const delta=new THREE.Vector3(x,y,z).sub(this.mesh.position);this.setBindings(null);this.params.normalBindings=null;this.setEndpoints(this.pointA.clone().add(delta),this.pointB.clone().add(delta));}
  setRotation(x,y,z){const midpoint=this.mesh.position.clone(),half=new THREE.Vector3(0,this.pointA.distanceTo(this.pointB)/2,0).applyEuler(new THREE.Euler(...[x,y,z].map(THREE.MathUtils.degToRad)));this.setBindings(null);this.params.surfaceNormals=null;this.params.normalBindings=null;this.setEndpoints(midpoint.clone().sub(half),midpoint.clone().add(half));}
  setHeat(){} // Workshop view is deliberately unlit.
}
