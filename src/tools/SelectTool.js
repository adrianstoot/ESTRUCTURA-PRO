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
    const clickedObj=this.sceneManager.getBIMObjectAtMouse(event);

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
