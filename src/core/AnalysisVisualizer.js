import * as THREE from 'three';

export class AnalysisVisualizer {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.enabled = true;
    this.current = null;
  }

  clear() {
    if (this.current?.mesh && this.current.group) {
      this.current.mesh.remove(this.current.group);
      this.current.group.traverse(child => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach(material => material.dispose?.());
        else child.material?.dispose?.();
      });
    }
    this.current = null;
  }

  toggle(force) {
    this.enabled = typeof force === 'boolean' ? force : !this.enabled;
    if (this.current?.group) this.current.group.visible = this.enabled;
    return this.enabled;
  }

  show(profile, result = profile?.analysisResults) {
    this.clear();
    if (!profile?.mesh || profile.type !== 'profile' || !result) return;
    const L = Number(profile.params.length) || 1;
    const h = (Number(profile.engineeringData?.h) || 200) / 1000;
    const b = (Number(profile.engineeringData?.b) || 120) / 1000;
    const actions = result.input || profile.analysisInput || {};
    const group = new THREE.Group();
    group.name = '__analysis_diagrams';
    group.renderOrder = 800;
    group.raycast = () => {};

    const samples = 41;
    const baseY = h / 2 + Math.max(.06, h * .22);
    const momentScale = Math.max(.18, Math.min(1.1, L * .08));
    const curve = [];
    const vertices = [];
    const indices = [];
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const z = -L/2 + t*L;
      const shape = 4*t*(1-t);
      const y = baseY + shape*momentScale;
      curve.push(new THREE.Vector3(0, y, z));
      vertices.push(0, baseY, z, 0, y, z);
      if (i < samples - 1) {
        const k = i * 2;
        indices.push(k, k+1, k+2, k+1, k+3, k+2);
      }
    }
    const momentGeometry = new THREE.BufferGeometry();
    momentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    momentGeometry.setIndex(indices);
    momentGeometry.computeVertexNormals();
    const momentSurface = new THREE.Mesh(momentGeometry, new THREE.MeshBasicMaterial({ color: 0x2d83ff, transparent: true, opacity: .24, side: THREE.DoubleSide, depthWrite: false }));
    momentSurface.name = '__moment_surface';
    momentSurface.raycast = () => {};
    const momentLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve), new THREE.LineBasicMaterial({ color: 0x58a3ff, depthTest: false }));
    momentLine.name = '__moment_line';
    momentLine.raycast = () => {};
    momentLine.renderOrder = 802;
    group.add(momentSurface, momentLine);

    const shearPoints = [];
    const shearScale = Math.max(.14, Math.min(.65, L*.045));
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      shearPoints.push(new THREE.Vector3(b/2 + .09, (1-2*t)*shearScale, -L/2+t*L));
    }
    const shearLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(shearPoints), new THREE.LineBasicMaterial({ color: 0xff5964, depthTest: false }));
    shearLine.name = '__shear_line';
    shearLine.raycast = () => {};
    shearLine.renderOrder = 802;
    group.add(shearLine);

    const deflectionCheck = result.checks?.find?.(check => check.id === 'member-deflection');
    const deflectionMm = Number(deflectionCheck?.demand ?? deflectionCheck?.values?.deltaEstimated_mm ?? result.serviceability?.deflectionMm ?? result.deflectionMm ?? 0);
    if (deflectionMm > 0) {
      const deflectionPoints = [];
      const visualScale = Math.max(.08, Math.min(.5, deflectionMm / 100));
      for (let i = 0; i < samples; i++) {
        const t = i / (samples - 1);
        deflectionPoints.push(new THREE.Vector3(-b/2-.08, -4*t*(1-t)*visualScale, -L/2+t*L));
      }
      const material = new THREE.LineDashedMaterial({ color: 0xffc857, dashSize: .08, gapSize: .04, depthTest: false });
      const deflection = new THREE.Line(new THREE.BufferGeometry().setFromPoints(deflectionPoints), material);
      deflection.computeLineDistances();
      deflection.name = '__deformed_line';
      deflection.raycast = () => {};
      deflection.renderOrder = 802;
      group.add(deflection);
    }

    // Section stress heat map (qualitative bending distribution).
    profile.mesh.updateWorldMatrix(true, true);
    const inverseRoot = profile.mesh.matrixWorld.clone().invert();
    const heatOpacity = Math.min(.56, .24 + .18 * Math.min(1, Number(result.ratio) || 0));
    profile.mesh.traverse(source => {
      if (!source.isMesh || source.name?.startsWith('__') || source.parent === group) return;
      const geometry = source.geometry?.clone?.();
      const positions = geometry?.getAttribute?.('position');
      if (!geometry || !positions) return;
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const span = Math.max(1e-9, box.max.y - box.min.y);
      const colors = new Float32Array(positions.count * 3);
      for (let index = 0; index < positions.count; index++) {
        const t = (positions.getY(index) - box.min.y) / span;
        const color = new THREE.Color().setRGB(
          .12 + .83 * t,
          .3 + .42 * (1 - Math.abs(2*t - 1)),
          .96 - .78 * t,
        );
        colors[index*3] = color.r; colors[index*3+1] = color.g; colors[index*3+2] = color.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const heatMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: heatOpacity,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
      }));
      heatMesh.name = '__section_heatmap';
      heatMesh.renderOrder = 801;
      heatMesh.raycast = () => {};
      source.updateWorldMatrix(true, false);
      heatMesh.matrixAutoUpdate = false;
      heatMesh.matrix.copy(inverseRoot).multiply(source.matrixWorld);
      group.add(heatMesh);
    });

    group.userData = {
      kind: 'analysis-diagrams',
      MEd: Number(actions.MEd || actions.MyEd || 0),
      VEd: Number(actions.VEd || 0),
      NEd: Number(actions.NEd || 0),
      utilization: Number(result.ratio || 0),
    };
    group.visible = this.enabled;
    profile.mesh.add(group);
    this.current = { mesh: profile.mesh, object: profile, group };
  }
}
