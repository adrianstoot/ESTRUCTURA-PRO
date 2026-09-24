/**
 * SelectTool — Click to select/deselect BIM objects in the scene.
 * Finds the parent BIMElement of any clicked mesh child.
 */
export class SelectTool {
  constructor(sceneManager, snapManager, onSelect) {
    this.sceneManager = sceneManager;
    this.snapManager = snapManager;
    this.onSelect = onSelect;
    this.selected = null;
    this.selectedSet = new Set();
  }

  handleClick(event) {
    const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
    const mouse = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };

    this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);
    const selectables = this.sceneManager.getSelectableObjects();
    const hits = this.sceneManager.raycaster.intersectObjects(selectables, true);

    let clickedObj = null;
    if (hits.length > 0) {
      let target = hits[0].object;
      while (target && !target.userData?.bimId) target = target.parent;
      if (target && target.userData?.bimId) {
        clickedObj = this.sceneManager.objects.find(o => o.id === target.userData.bimId);
      }
    }

    const additive = event.ctrlKey || event.metaKey || event.shiftKey;

    if (!additive) {
      this.selectedSet.forEach(o => o.setSelected && o.setSelected(false));
      this.selectedSet.clear();
    }

    if (clickedObj) {
      if (this.selectedSet.has(clickedObj) && additive) {
        this.selectedSet.delete(clickedObj);
        clickedObj.setSelected(false);
        this.selected = this.selectedSet.size ? Array.from(this.selectedSet).pop() : null;
      } else {
        clickedObj.setSelected(true);
        this.selectedSet.add(clickedObj);
        this.selected = clickedObj;
      }
    } else if (!additive) {
      this.selected = null;
      this.sceneManager.detachGizmo();
    }

    if (this.onSelect) this.onSelect(this.selected);
  }
}
