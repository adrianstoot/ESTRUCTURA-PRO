import * as THREE from 'three';
import {escapeHTML as esc} from './WorkshopGeometry.js';

export function drawingSVG(object){
  object.mesh.updateWorldMatrix(true,true);const inverse=object.mesh.matrixWorld.clone().invert(),segments=[],box=new THREE.Box3();
  object.mesh.traverseVisible(mesh=>{if(!mesh.isMesh)return;const matrix=inverse.clone().multiply(mesh.matrixWorld),edges=new THREE.EdgesGeometry(mesh.geometry,20),pos=edges.attributes.position;for(let i=0;i<pos.count;i+=2){const a=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix).multiplyScalar(1000),b=new THREE.Vector3().fromBufferAttribute(pos,i+1).applyMatrix4(matrix).multiplyScalar(1000);segments.push([a,b]);box.expandByPoint(a);box.expandByPoint(b);}edges.dispose();});
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const views=[['ALZADO · XY','x','y'],['PLANTA · XZ','x','z'],['PERFIL · ZY','z','y']];
  const num=n=>Number(n.toFixed(2)).toLocaleString('es-ES');
  const panels=views.map(([label,u,v],index)=>{
    const x=35+index*375,y=110,scale=Math.min(280/Math.max(size[u],1),320/Math.max(size[v],1));
    const project=p=>[x+170+(p[u]-center[u])*scale,y+200-(p[v]-center[v])*scale];
    const seen=new Set();const lines=segments.map(([a,b])=>{const p=project(a),q=project(b),key=[p,q].map(t=>t.map(n=>n.toFixed(2)).join(',')).sort().join(';');if(seen.has(key)||Math.hypot(p[0]-q[0],p[1]-q[1])<.02)return'';seen.add(key);return`<path d="M${p.join(' ')} L${q.join(' ')}"/>`;}).join('');
    const min=project(box.min),max=project(box.max),bottom=y+390;
    return `<g><text x="${x}" y="${y-12}" class="view">${label}</text><g stroke="#34424a" fill="none" stroke-width=".65">${lines}</g><g stroke="#607b8a" stroke-width=".7"><path d="M${min[0]} ${bottom-12}v24 M${max[0]} ${bottom-12}v24 M${min[0]} ${bottom}H${max[0]}"/><path d="M${x+330} ${min[1]}H${x+345} M${x+330} ${max[1]}H${x+345} M${x+338} ${min[1]}V${max[1]}"/></g><text x="${x+170}" y="${bottom-6}" text-anchor="middle">${num(size[u])} mm</text><text x="${x+334}" y="${y+200}" transform="rotate(-90 ${x+334} ${y+200})" text-anchor="middle">${num(size[v])} mm</text></g>`;
  }).join('');
  const p=object.params;
  const dims=object.type==='profile'?`Longitud de corte ${num(p.length*1000)} mm · ${object.designation}`:object.type==='plate'?`Chapa ${num(p.width*1000)} × ${num(p.height*1000)} × ${num(p.thickness*1000)} mm`:object.designation;
  const holes=(p.holes||[]).map((h,i)=>h.points?`Hueco ${i+1}: contorno de ${h.points.length} vértices (mm) · `+h.points.map(v=>`${num(v.x*1000)},${num(v.y*1000)}`).join(' / '):`T${i+1}: Ø${num((h.diameter||h.radius*2)*1000)} · X ${num(h.x*1000)} · Y ${num(h.y*1000)} mm`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.max(690,630+holes.length*17)}" viewBox="0 0 1200 ${Math.max(690,630+holes.length*17)}"><rect width="100%" height="100%" fill="white"/><style>text{font-family:Arial,sans-serif;font-size:12px;fill:#263942}.title{font-size:22px;font-weight:bold}.view{font-size:11px;font-weight:bold;letter-spacing:1.5px}.note{fill:#617682;font-size:11px}</style><text x="35" y="42" class="title">${esc(p.role||object.designation)}</text><text x="35" y="65" class="note">ESTRUCTURAS PRO · PLANO DE TALLER · COTAS EN mm · EJES LOCALES · PROYECCIÓN GEOMÉTRICA</text>${panels}<path d="M35 540H1160" stroke="#c4cdd2"/><text x="35" y="570">${esc(dims)} · ${esc(object.steelGrade)}</text><text x="35" y="592" class="note">Las cotas prevalecen sobre la escala de pantalla. Aristas proyectadas; revise las caras ocultas en el modelo.</text>${holes.map((line,i)=>`<text x="35" y="${621+i*17}">${line}</text>`).join('')}</svg>`;
}

export function showDrawing(object){
  const svg=drawingSVG(object),modal=document.createElement('div');modal.className='workshop-modal';
  modal.innerHTML=`<section role="dialog" aria-modal="true" aria-label="Plano de taller"><header><h2>Plano de taller</h2><button data-close aria-label="Cerrar">×</button></header><div class="workshop-drawing">${svg}</div><footer><span>Todas las cotas en mm · SVG vectorial</span><button class="primary" data-export>Exportar plano SVG</button></footer></section>`;
  document.body.appendChild(modal);modal.querySelector('[data-close]').onclick=()=>modal.remove();
  modal.querySelector('[data-export]').onclick=()=>{const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download=`plano-${object.id}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
