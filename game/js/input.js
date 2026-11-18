// input.js — keyboard + mouse state for twin-stick control.
// WASD / arrow keys move, the mouse aims, mouse button or SPACE fires,
// SHIFT dashes. P / Esc toggles pause, R restarts, Enter confirms — those
// discrete events are delivered through callbacks so game.js owns state.

export class Input {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks || {};
    this.keys = new Set();
    this.mouseX = 640;
    this.mouseY = 360;
    this.mouseDown = false;

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.updateMouse(e);
      this.mouseDown = true;
      if (this.callbacks.onPress) this.callbacks.onPress();
      if (this.callbacks.onClick) this.callbacks.onClick();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKeyDown(e) {
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    if (gameKeys.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if ((e.code === 'KeyP' || e.code === 'Escape') && this.callbacks.onPause) {
      this.callbacks.onPause();
    }
    if (e.code === 'KeyR' && this.callbacks.onRestart) this.callbacks.onRestart();
    if (e.code === 'Enter' && this.callbacks.onConfirm) this.callbacks.onConfirm();
    if (this.callbacks.onPress) this.callbacks.onPress();
  }

  updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
  }

  // Normalised movement vector from the held keys.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  get firing() {
    return this.mouseDown || this.keys.has('Space');
  }

  get dashing() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }
}
