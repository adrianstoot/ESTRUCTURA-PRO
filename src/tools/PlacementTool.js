import * as THREE from 'three';
import { Profile } from '../entities/Profile.js';
import { Plate } from '../entities/Plate.js';
import { Fastener } from '../entities/Fastener.js';
import { getSizes } from '../entities/ProfileCatalog.js';
import { escapeHTML, finitePositive, mm } from '../core/WorkshopGeometry.js';
import { applyWorkshopStyle } from '../core/WorkshopMaterial.js';

export class PlacementTool {
  constructor(scene,snap,{onCommit,toast}={}) {this.scene=scene;this.snap=snap;this.onCommit=onCommit;this.toast=toast;this.active=false;}
  begin(spec) {
    this.cancel();this.active=true;this.spec=spec;this.scene.detachGizmo();
    const object=spec.object || (spec.type==='profile'?new Profile(spec.series,spec.size,spec.length,spec.orientation):spec.type==='plate'?new Plate(spec.subtype,spec.width,spec.height,spec.thickness,spec.options||{}):new Fastener(spec.subtype,spec.metric));
    this.preview=object;
    const box=new THREE.Box3();this.scene.objects.forEach(o=>{if(o.mesh.visible)box.expandByObject(o.mesh);});
    const own=object.getBoundingBox().getSize(new THREE.Vector3());
    const x=box.isEmpty()?0:box.max.x+.15+own.x/2;
    const y=object.type==='profile'&&object.params.orientation==='column'?object.params.length/2:object.type==='plate'&&object.params.subtype==='base'?object.params.thickness/2:own.y/2;
    this.scene.scene.add(object.mesh);applyWorkshopStyle(object);
    const panel=document.createElement('form');panel.className='workshop-placement';panel.setAttribute('aria-label','Colocar pieza');
    const field=(id,label,value,min)=>`<label>${label}<span><input name="${id}" type="number" step="any" value="${value}" ${min!=null?`min="${min}"`:''} required> <em>mm</em></span></label>`;
    const p=object.params;
    panel.innerHTML=`<header><div><small>COLOCACIÓN PRECISA</small><h3>${escapeHTML(object.designation)}</h3></div><button type="button" data-cancel aria-label="Cancelar colocación">×</button></header>
      <p>El punto indicado es el centro de la pieza. Clic en el modelo para capturar su posición.</p>
      <label>Referencia<select name="reference"><option value="center">Centro de pieza</option>${object.type==='profile'?'<option value="ends">Dos extremos del eje</option>':''}${object.type==='plate'&&p.subtype!=='cleat'?'<option value="face">Apoyar sobre una cara</option>':''}</select></label><div data-placement-hint role="status"></div>
      ${object.type==='profile'?`<label>Sección<select name="size">${getSizes(p.series).map(s=>`<option ${String(s)===String(p.size)?'selected':''}>${s}</option>`).join('')}</select></label>${field('length','Longitud',p.length*1000,1)}`:''}
      ${object.type==='plate'?`${field('width','Ancho',p.width*1000,1)}${field('height','Alto',p.height*1000,1)}${field('thickness','Espesor',p.thickness*1000,.1)}`:''}
      ${object.type==='fastener'?`<label>Métrica<select name="metric">${['M12','M16','M20','M24','M27','M30'].map(m=>`<option ${m===p.metric?'selected':''}>${m}</option>`).join('')}</select></label>${field('shankLength','Vástago',p.shankLength||60,1)}`:''}
      <div class="workshop-triplet">${field('x','X',Math.round(x*1000))}${field('y','Y',Math.round(y*1000))}${field('z','Z',0)}</div>
      <label>Plano / dirección<select name="direction"><option value="native">${object.type==='profile'&&p.orientation==='column'?'Pilar vertical Y':object.type==='plate'?'Chapa vertical XY':object.type==='fastener'?'Eje Y · cara de apoyo':'Eje Z'}</option><option value="x">Eje X / chapa YZ</option><option value="y">Eje Y / chapa horizontal XZ</option><option value="z">Eje Z / chapa vertical XY</option></select></label>
      <div class="workshop-triplet">${['rx','ry','rz'].map(n=>`<label>${n.toUpperCase()} °<input name="${n}" type="number" step="0.1" value="0" required></label>`).join('')}</div>
      <div class="workshop-error" role="alert"></div><footer><button type="button" data-cancel>Cancelar</button><button type="submit" class="primary">Crear pieza</button></footer>`;
    this.panel=panel;this.scene.container.appendChild(panel);
    if(object.type==='plate'&&p.subtype==='base')panel.elements.direction.value='y';
    panel.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>this.cancel());
    panel.addEventListener('input',()=>this.update());panel.addEventListener('change',()=>this.update());
    panel.onsubmit=e=>{e.preventDefault();this.commit();};this.update();
    panel.querySelector('input')?.focus();
  }
  update() {
    if(!this.active)return false;
    try {
      const f=this.panel.elements,get=name=>f.namedItem(name),p={...this.preview.params};
      for(const key of ['length','width','height','thickness']){const input=get(key);if(input)p[key]=mm(finitePositive(input.value,key));}
      if(get('size'))p.size=get('size').value;if(get('metric'))p.metric=get('metric').value;
      if(get('shankLength'))p.shankLength=finitePositive(get('shankLength').value,'Vástago');
      const values=['x','y','z','rx','ry','rz'].map(k=>{const input=get(k);if(input.value.trim()==='')throw new Error('Complete las coordenadas.');return Number(input.value);});
      if(values.some(v=>!Number.isFinite(v)))throw new Error('Coordenadas no válidas.');
      // Polygon dimensions are editable by scaling its local vertices once.
      if(p.points && this.preview.params.width && this.preview.params.height)p.points=p.points.map(v=>({x:v.x*p.width/this.preview.params.width,y:v.y*p.height/this.preview.params.height}));
      this.preview.update(p);
      const base=new THREE.Quaternion(),dir=get('direction').value;
      if(this.preview.type==='profile')base.setFromUnitVectors(new THREE.Vector3(0,0,1),dir==='x'?new THREE.Vector3(1,0,0):dir==='y'||(dir==='native'&&p.orientation==='column')?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1));
      else if(this.preview.type==='plate')base.setFromUnitVectors(new THREE.Vector3(0,0,1),dir==='x'?new THREE.Vector3(1,0,0):dir==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1));
      else if(this.preview.type==='fastener')base.setFromUnitVectors(new THREE.Vector3(0,1,0),dir==='x'?new THREE.Vector3(1,0,0):dir==='z'?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0));
      this.preview.mesh.quaternion.setFromEuler(new THREE.Euler(...values.slice(3).map(v=>THREE.MathUtils.degToRad(v)))).multiply(base);
      this.preview.setPosition(...values.slice(0,3).map(mm));
      applyWorkshopStyle(this.preview);this.preview.mesh.traverse(c=>{if(c.isMesh){c.material.transparent=true;c.material.opacity=.5;c.material.depthWrite=false;}});
      this.panel.querySelector('.workshop-error').textContent='';return true;
    }catch(error){this.panel.querySelector('.workshop-error').textContent=error.message;return false;}
  }
  pick(event) {
    if(!this.active)return;
    const point=this.snap.update(event);if(!point)return;
    const f=this.panel.elements,get=name=>f.namedItem(name),mode=get('reference').value,info=this.snap.lastSnapInfo;
    if(mode==='ends'){
      if(!this.firstEnd){this.firstEnd=point.clone();this.panel.querySelector('[data-placement-hint]').textContent='Primer extremo fijado. Seleccione el segundo.';return;}
      const delta=point.clone().sub(this.firstEnd),length=delta.length();if(length<.001){this.panel.querySelector('[data-placement-hint]').textContent='Separe los extremos al menos 1 mm.';return;}
      const center=point.clone().add(this.firstEnd).multiplyScalar(.5),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),delta.normalize()),angles=new THREE.Euler().setFromQuaternion(q);
      get('length').value=(length*1000).toFixed(3);get('direction').value='z';['rx','ry','rz'].forEach((k,i)=>get(k).value=THREE.MathUtils.radToDeg(angles.toArray()[i]));point.copy(center);this.firstEnd=null;this.panel.querySelector('[data-placement-hint]').textContent='Eje y longitud calculados con los dos extremos.';
    }else if(mode==='face'){
      if(!info?.normal||!info.bimObject){this.panel.querySelector('[data-placement-hint]').textContent='Seleccione una cara visible de una pieza.';return;}
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),info.normal),angles=new THREE.Euler().setFromQuaternion(q);get('direction').value='z';['rx','ry','rz'].forEach((k,i)=>get(k).value=THREE.MathUtils.radToDeg(angles.toArray()[i]));point.addScaledVector(info.normal,this.preview.params.thickness/2);this.preview.params.referenceObjectId=info.bimObject.id;this.panel.querySelector('[data-placement-hint]').textContent='Cara de apoyo capturada; el espesor queda hacia el exterior.';
    }
    for(const axis of ['x','y','z'])get(axis).value=(point[axis]*1000).toFixed(3);
    this.update();
  }
  commit() {
    if(!this.update())return;
    const object=this.preview;
    this.scene.scene.remove(object.mesh);this.panel.remove();this.preview=null;this.panel=null;this.active=false;
    this.scene.addObject(object);this.onCommit?.(object);this.toast?.(`${object.designation} creada · posición en mm`);
  }
  cancel() {
    if(this.preview){this.scene.scene.remove(this.preview.mesh);this.preview._disposeMesh();}
    this.panel?.remove();this.preview=null;this.panel=null;this.active=false;this.firstEnd=null;
  }
}
