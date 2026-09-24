import * as THREE from 'three';

// Face palette, baked into geometry: unlit, no maps, lights or environment.
export function prepareWorkshopGeometry(geometry) {
  if(geometry.userData.workshopPalette) return;
  const normal=geometry.attributes.normal;
  if(!normal) geometry.computeVertexNormals();
  const n=geometry.attributes.normal, colors=new Float32Array(n.count*3);
  for(let i=0;i<n.count;i++) {
    const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));
    const shade=z>=x && z>=y?0.65:y>=x?1:0.81;
    colors.set([shade,shade,shade],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.userData.workshopPalette=true;
}
export function workshopMaterial(color='#81909b') {
  return new THREE.MeshBasicMaterial({color,vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
}
export function applyWorkshopStyle(object,mode='clay') {
  const solids=[];
  object.mesh?.traverse(child=>{if(child.isMesh) solids.push(child);});
  for(const child of solids) {
    prepareWorkshopGeometry(child.geometry);
    if(!child.material?.isMeshBasicMaterial || Array.isArray(child.material)) {
      const old=Array.isArray(child.material)?child.material:[child.material];
      child.material=workshopMaterial(object.color);
      old.forEach(m=>m?.dispose());
    }
    const mat=child.material;
    mat.color.set(object._isSelected?'#43a8d1':object.color);
    mat.wireframe=mode==='wire'; mat.transparent=mode==='xray'; mat.opacity=mode==='xray'?.28:1;
    mat.depthWrite=mode!=='xray'; mat.needsUpdate=true;
    child.castShadow=child.receiveShadow=false;
    if(!child.children.some(c=>c.userData.workshopEdges)) {
      const edgeGeometry=child.geometry.userData.workshopSnapEdges||new THREE.EdgesGeometry(child.geometry,24);
      child.geometry.userData.workshopSnapEdges=edgeGeometry;
      const edge=new THREE.LineSegments(edgeGeometry,new THREE.LineBasicMaterial({color:'#3a4650',transparent:true,opacity:.68}));
      edge.userData.workshopEdges=true; edge.raycast=()=>{}; child.add(edge);
    }
    child.children.filter(c=>c.userData.workshopEdges).forEach(c=>{c.visible=mode!=='wire';c.material.color.set(object._isSelected?'#126683':'#3a4650');});
  }
}
