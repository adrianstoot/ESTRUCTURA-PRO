import { validateHolesInContour } from './WorkshopGeometry.js';

// Baking a scale keeps displayed fabrication dimensions equal to the geometry.
// Catalogue sections and circular holes must retain their original shape.
export function bakeParametricScale(object){
  const s=object.mesh.scale.clone(),p={...object.params},near=(a,b)=>Math.abs(a-b)<1e-8;
  if(near(s.x,1)&&near(s.y,1)&&near(s.z,1))return false;
  const reset=()=>object.mesh.scale.set(1,1,1);
  try{
    if([s.x,s.y,s.z].some(n=>!Number.isFinite(n)||n<=0))throw new Error('Use una escala positiva.');
    if(object.type==='profile'){
      if(!near(s.x,1)||!near(s.y,1))throw new Error('La sección se cambia desde el catálogo; solo se puede escalar la longitud local Z.');
      p.length*=s.z;
      p.drillings=p.drillings?.map(h=>({...h,z:h.z*s.z}));p.webDrillings=p.webDrillings?.map(h=>({...h,z:h.z*s.z}));
      for(const key of['endCutStart','endCutEnd'])if(p[key]){const c=p[key];p[key]={normal:[c.normal[0],c.normal[1],c.normal[2]/s.z],constant:c.constant};}
    }else if(object.type==='plate'){
      if(['cleat','folded'].includes(p.subtype))throw new Error('Edite las dimensiones del casquillo o chapa plegada desde Propiedades.');
      if(p.holes?.length&&!near(s.x,s.y))throw new Error('Escalado no uniforme: deformaría los taladros. Edite las cotas de la chapa.');
      p.width*=s.x;p.height*=s.y;p.thickness*=s.z;p.points=p.points?.map(v=>({x:v.x*s.x,y:v.y*s.y}));
      p.holes=p.holes?.map(h=>h.points?{...h,points:h.points.map(v=>({x:v.x*s.x,y:v.y*s.y}))}:{...h,x:h.x*s.x,y:h.y*s.y,diameter:(h.diameter||h.radius*2)*s.x,radius:undefined});
      if(p.holes?.length&&!p.holes.some(h=>h.points))validateHolesInContour(p.points||[{x:-p.width/2,y:-p.height/2},{x:p.width/2,y:-p.height/2},{x:p.width/2,y:p.height/2},{x:-p.width/2,y:p.height/2}],p.holes,.5);
    }else throw new Error('Edite las dimensiones de esta pieza desde Propiedades.');
    reset();object.update(p);return true;
  }catch(error){reset();object.mesh.updateMatrixWorld(true);throw error;}
}
