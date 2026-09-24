import * as THREE from 'three';

// Internal world coordinates remain metres for backwards-compatible projects.
// Every public workshop input/output is millimetres; conversion happens once.
export const mm = value => Number(value) / 1000;
export const inMM = value => Number(value) * 1000;
export const formatMM = value => `${(inMM(value)).toLocaleString('es-ES', { maximumFractionDigits: 2 })} mm`;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const finitePositive = (value, name = 'Dimensión') => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name}: introduzca un valor mayor que cero.`);
  return n;
};
export function validatePolygon(points) {
  if (!Array.isArray(points) || points.length < 3) throw new Error('El contorno necesita al menos tres vértices.');
  const p = points.map(v => ({ x: Number(v.x ?? v[0]), y: Number(v.y ?? v[1]) }));
  if (p.some(v => !Number.isFinite(v.x + v.y))) throw new Error('Coordenadas no válidas en el contorno.');
  const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const between = (a,b,c) => Math.abs(cross(a,b,c)) < 1e-12 && c.x >= Math.min(a.x,b.x)-1e-12 && c.x <= Math.max(a.x,b.x)+1e-12 && c.y >= Math.min(a.y,b.y)-1e-12 && c.y <= Math.max(a.y,b.y)+1e-12;
  const intersects = (a,b,c,d) => (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) || between(a,b,c) || between(a,b,d) || between(c,d,a) || between(c,d,b);
  let area = 0;
  for (let i=0; i<p.length; i++) {
    const a=p[i], b=p[(i+1)%p.length];
    if (Math.hypot(a.x-b.x,a.y-b.y)<1e-9) throw new Error('El contorno contiene vértices duplicados.');
    area += a.x*b.y-b.x*a.y;
    for(let j=i+1;j<p.length;j++) {
      if(j===i+1 || (i===0 && j===p.length-1)) continue;
      if(intersects(a,b,p[j],p[(j+1)%p.length])) throw new Error('El contorno se cruza. Corrija los vértices antes de extruir.');
    }
  }
  if(Math.abs(area)<1e-12) throw new Error('El contorno no encierra una superficie.');
  return p;
}

export function categoryOf(object) {
  if (object.params?.category) return object.params.category;
  const role = `${object.params?.role || ''} ${object.params?.componentRole || ''} ${object.params?.subtype || ''}`.toLowerCase();
  if (/rebar|mesh|negative|armadura|mallazo|negativo/.test(role)) return 'reinforcement';
  if (/floor|forjado|deck|losa|chapa colaborante/.test(role)) return 'floor';
  if (object.type==='plate' && /rigidizador|stiffener/.test(role)) return 'stiffener';
  return object.type;
}

export function semanticPoints(object) {
  const points = [];
  if (!object?.mesh) return points;
  object.mesh.updateWorldMatrix(true,true);
  const add = (p, type, label) => points.push({point:p.clone().applyMatrix4(object.mesh.matrixWorld),type,feature:label,bimObject:object});
  if(object.type==='plate') {
    for(const hole of object.params.holes || []) {
      for(const side of [-1,1]) add(new THREE.Vector3(hole.x || 0,hole.y || 0,side*object.params.thickness/2),'center','Centro de taladro');
    }
  }
  if(object.type==='profile') {
    const section = object.mesh.children.find(c=>c.name?.endsWith('sección'));
    for(const end of [-1,1]) {
      add(new THREE.Vector3(0,0,end*object.params.length/2),'center','Eje del perfil');
      const e=object.engineeringData;
      if(section && e?.b && e?.h && e?.tf) {
        // Editable workshop gauge; never presented as a certified catalogue value.
        const gauge=object.params.gaugeMm;
        if(Number.isFinite(gauge) && gauge>0) for(const sx of [-1,1]) for(const sy of [-1,1]) {
          const v=new THREE.Vector3(mm(sx*gauge/2),mm(sy*e.h/2),end*object.params.length/2).applyMatrix4(section.matrix);
          add(v,'gauge','Gramil definido por el usuario');
        }
      }
    }
  }
  return points;
}

export function memberEndpoints(object) {
  object.mesh.updateWorldMatrix(true,true);
  return [-1,1].map(s=>new THREE.Vector3(0,0,s*object.params.length/2).applyMatrix4(object.mesh.matrixWorld));
}

export function validateHolesInContour(points,holes,edgeFactor=1.5){
  const polygon=validatePolygon(points);
  const inside=p=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
  for(const [i,h]of holes.entries()){
    const radius=h.radius||h.diameter/2;if(!(radius>0)||!Number.isFinite(h.x+h.y))throw new Error('Taladro no válido.');
    if(!inside(h))throw new Error(`Taladro ${i+1} fuera del contorno.`);
    let distance=Infinity;
    for(let j=0;j<polygon.length;j++){const a=polygon[j],b=polygon[(j+1)%polygon.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((h.x-a.x)*dx+(h.y-a.y)*dy)/(dx*dx+dy*dy)));distance=Math.min(distance,Math.hypot(h.x-a.x-t*dx,h.y-a.y-t*dy));}
    if(distance+1e-8<edgeFactor*radius*2)throw new Error(`Taladro ${i+1}: distancia al contorno ${(distance*1000).toFixed(1)} mm, mínimo ${(edgeFactor*radius*2000).toFixed(1)} mm.`);
    for(let j=0;j<i;j++)if(Math.hypot(h.x-holes[j].x,h.y-holes[j].y)<radius+(holes[j].radius||holes[j].diameter/2)-1e-8)throw new Error('Dos agujeros se solapan.');
  }
  return true;
}

// Geometric fabrication rule only. It does not assert joint resistance.
export function boltLayout({width,height,diameter=20,rows=2,cols=2,edge=40,pitchX,pitchY,edgeFactor=1.5,pitchFactor=3}) {
  [width,height,diameter,edge].forEach(v=>finitePositive(v));
  if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1||rows*cols>200) throw new Error('Matriz: entre 1 y 200 tornillos.');
  const hole=diameter+(diameter<=24?2:3);
  const minEdge=edgeFactor*hole, minPitch=pitchFactor*hole;
  if(edge<minEdge) throw new Error(`Distancia a borde: mínimo geométrico ${minEdge.toFixed(1)} mm para Ø${hole}.`);
  const px=pitchX??(cols>1?(width-2*edge)/(cols-1):0);
  const py=pitchY??(rows>1?(height-2*edge)/(rows-1):0);
  if((cols>1 && px<minPitch)||(rows>1 && py<minPitch)) throw new Error(`Separación insuficiente: se necesitan al menos ${minPitch.toFixed(1)} mm.`);
  if((cols-1)*px+2*edge>width+1e-6 || (rows-1)*py+2*edge>height+1e-6) throw new Error('La matriz no cabe en la chapa con esos bordes.');
  return {hole,edge,pitchX:px,pitchY:py,rule:`TALLER-02 · e ≥ ${edgeFactor} d₀, p ≥ ${pitchFactor} d₀ · mínimos geométricos configurados`,points:Array.from({length:rows*cols},(_,i)=>({x:mm((i%cols-(cols-1)/2)*px),y:mm((Math.floor(i/cols)-(rows-1)/2)*py)}))};
}
