import * as THREE from 'three';
import { SceneManager } from '../src/core/SceneManager.js';
import { SnapManager } from '../src/core/SnapManager.js';
import { GridManager } from '../src/core/GridManager.js';
import { Profile } from '../src/entities/Profile.js';
import { Plate } from '../src/entities/Plate.js';
import { MeasureTool } from '../src/tools/MeasureTool.js';
import { PlacementTool } from '../src/tools/PlacementTool.js';
import { PresetManager,STRUCTURE_PRESETS,CONNECTION_PRESETS } from '../src/presets/PresetManager.js';

const container=document.querySelector('#canvas-container'),output=document.querySelector('#results'),sm=new SceneManager(container),grid=new GridManager(sm.scene,40),snap=new SnapManager(sm,grid),measure=new MeasureTool(sm,snap),presets=new PresetManager({sceneManager:sm}),select=document.querySelector('#preset');
for(const p of[...STRUCTURE_PRESETS,...CONNECTION_PRESETS])select.add(new Option(p.title,p.id));
const clear=()=>{sm.objects.slice().forEach(o=>sm.removeObject(o));measure.clearAll();};
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const log=value=>output.textContent+=value+'\n';
const check=(condition,label)=>{log((condition?'PASS':'FAIL')+' · '+label);if(!condition)throw new Error(label);};
document.querySelector('#show').onclick=()=>{clear();presets.generate(select.value);};
document.querySelector('#run').onclick=async()=>{
  output.textContent='';document.querySelector('#run').disabled=true;
  try{
    clear();const plate=new Plate('base',1,1,.02);plate.setPosition(.8,1,0);sm.addObject(plate);sm.setCameraView('front');sm.fitAll();await frame();
    check(sm.camera.isOrthographicCamera,'Alzado ortográfico real');
    const before=sm.camera.getWorldDirection(new THREE.Vector3());sm.resetZoom();check(before.angleTo(sm.camera.getWorldDirection(new THREE.Vector3()))<1e-7,'Restablecer encuadre conserva la vista');
    for(const view of['front','iso']){
      sm.setCameraView(view);sm.fitAll();await frame();sm.orbitControls.enableDamping=false;
      const target=plate.mesh.localToWorld(new THREE.Vector3(.18,.14,.01)),before=target.clone().project(sm.camera),r=sm.renderer.domElement.getBoundingClientRect(),x=r.left+(before.x+1)*r.width/2,y=r.top+(1-before.y)*r.height/2;
      sm.zoomAtPointer({clientX:x,clientY:y,deltaY:-120,deltaMode:0,preventDefault(){},stopImmediatePropagation(){}});await frame();const after=target.clone().project(sm.camera),drift=Math.hypot(after.x-before.x,after.y-before.y)*r.height/2;
      check(drift<.1,`Zoom ${view} conserva el punto bajo el cursor · error ${drift.toFixed(6)} px`);
    }
    sm.setCameraView('front');sm.fitAll();await frame();
    const r=sm.renderer.domElement.getBoundingClientRect(),p=plate.mesh.localToWorld(new THREE.Vector3(.5,.5,.01)),screen=p.clone().project(sm.camera),event={clientX:r.left+(screen.x+1)*r.width/2,clientY:r.top+(1-screen.y)*r.height/2};
    const picked=snap.update(event);check(picked&&picked.distanceTo(p)<.0001,'Captura de vértice visible con error menor que 0,1 mm');
    snap.setEnabled(false);check(!!snap.update({clientX:r.left+r.width/2,clientY:r.top+r.height/2}),'Captura libre sigue funcionando con imán desactivado');snap.setEnabled(true);
    const blocker=new Plate('base',2,2,.1);blocker.setPosition(.8,1,.3);sm.addObject(blocker);snap.update(event);check(snap.lastSnapInfo?.objectId===blocker.id,'Oclusión: no seleccionar arista tras una chapa opaca');sm.removeObject(blocker);
    measure._createMeasurement(new THREE.Vector3(0,0,0),new THREE.Vector3(.003,.004,.012));check(container.querySelector('.measure-label')?.textContent.includes('13.00'),'Cota diagonal de 13 mm');const saved=measure.serialize();measure.restore(saved);check(measure.measurements.length===1,'Restaurar cotas sin duplicados');
    const placement=new PlacementTool(sm,snap);placement.begin({type:'profile',series:'HEB',size:'200',length:3,orientation:'column'});
    check(placement.update()&&!placement.panel.querySelector('.workshop-error').textContent,'Crear perfil: longitud inicial válida');
    const lengthInput=placement.panel.elements.namedItem('length');lengthInput.value='1250';lengthInput.dispatchEvent(new Event('input',{bubbles:true}));
    check(placement.update()&&Math.abs(placement.preview.params.length-1.25)<1e-9,'Editar longitud en mm en el formulario de colocación');
    const placed=placement.preview;placement.commit();check(sm.objects.includes(placed),'Confirmar colocación crea el perfil en la escena');
    sm.renderer.render(sm.scene,sm.camera);const source=sm.renderer.domElement,copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;const ctx=copy.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,copy.width,copy.height).data;let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<180&&pixels[i+1]<190)dark++;check(dark>100,'El visor contiene geometría renderizada');
    const blob=await new Promise(resolve=>copy.toBlob(resolve,'image/png')),bytes=new Uint8Array(await blob.arrayBuffer()),data=new DataView(bytes.buffer);check(bytes[0]===137&&bytes[1]===80&&data.getUint32(16)===copy.width&&data.getUint32(20)===copy.height,`PNG válido ${copy.width} × ${copy.height} px`);document.querySelector('#snapshot').src=URL.createObjectURL(blob);
    for(const count of[100,500,1000]){
      clear();const buildStart=performance.now();for(let i=0;i<count;i++){const o=new Profile('IPE','200',1.5,'column');o.setPosition((i%32)*.6,.75,Math.floor(i/32)*.6);sm.addObject(o);}sm.setCameraView('iso');sm.fitAll();const built=performance.now()-buildStart;await frame();const times=[];
      for(let i=0;i<50;i++){const start=performance.now();sm.renderer.render(sm.scene,sm.camera);times.push(performance.now()-start);}const sorted=times.sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)],rect=sm.renderer.domElement.getBoundingClientRect(),samples=[];
      for(let i=0;i<10;i++)snap.update({clientX:rect.left+rect.width*.5,clientY:rect.top+rect.height*.5});
      for(let i=0;i<50;i++){const start=performance.now();snap.update({clientX:rect.left+rect.width*(.35+i*.006),clientY:rect.top+rect.height*.5});samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
      const phaseMs={},phaseCalls={},restore=[];
      const profile=(object,name,key=name)=>{const original=object[name];object[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{phaseMs[key]=(phaseMs[key]||0)+performance.now()-start;phaseCalls[key]=(phaseCalls[key]||0)+1;}};restore.push(()=>object[name]=original);};
      for(const name of['_semanticObjectNearPointer','_nearPointer','_pointCandidate','_pointVisible','_findFeatureSnaps','_getGeometryFeatures','_edgeCandidate'])profile(snap,name);
      profile(snap._raycaster,'intersectObjects','cursorRay');profile(snap._visibilityRaycaster,'intersectObjects','visibilityRay');
      for(let i=0;i<10;i++)snap.update({clientX:rect.left+rect.width*(.37+i*.01),clientY:rect.top+rect.height*.5});restore.forEach(fn=>fn());
      log(JSON.stringify({pieces:count,buildMs:+built.toFixed(1),renderSubmitMedianMs:+median.toFixed(2),snapP95Ms:+samples[Math.floor(samples.length*.95)].toFixed(2),snapMaxMs:+samples.at(-1).toFixed(2),phaseTotalMs:Object.fromEntries(Object.entries(phaseMs).map(([k,v])=>[k,+v.toFixed(1)])),phaseCalls,drawCalls:sm.renderer.info.render.calls,triangles:sm.renderer.info.render.triangles}));await frame();
    }
    clear();presets.generate('portal-duopitch');log('FIN · Pruebas del visor completadas.');
  }catch(error){log('ERROR · '+error.message);console.error(error);}finally{document.querySelector('#run').disabled=false;}
};
