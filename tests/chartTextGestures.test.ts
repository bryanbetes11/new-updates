import { bindChartTextGestures } from '../src/lib/chartTextGestures';

function check(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const element = new EventTarget() as unknown as HTMLElement;
let size = 16;
let pinching = false;
const dispose = bindChartTextGestures(element, { getSize: () => size, onSize: value => { size = value; }, onPinching: value => { pinching = value; } });
function emit(type: string, properties: Record<string, unknown>) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, properties);
  element.dispatchEvent(event);
  return event;
}
const normal = emit('wheel', { altKey: false, deltaY: -80, deltaMode: 0 });
check(size === 16 && !normal.defaultPrevented, 'Normal scrolling must remain unchanged');
const wheel = emit('wheel', { altKey: true, deltaY: -80, deltaMode: 0 });
check(size === 18 && wheel.defaultPrevented, 'Alt wheel up must enlarge text and prevent scrolling');
emit('wheel', { altKey: true, ctrlKey: true, deltaY: -80, deltaMode: 0 });
check(size === 18, 'Do not intercept browser zoom modifiers');
const touches = (distance: number) => [{ clientX: 0, clientY: 0 }, { clientX: distance, clientY: 0 }];
emit('touchstart', { touches: touches(100) });
emit('touchmove', { touches: touches(150) });
check(size === 27 && pinching, 'Pinch out must scale from the starting size');
emit('touchmove', { touches: touches(10) });
check(size === 8, 'Pinch must respect minimum font size');
emit('touchmove', { touches: touches(400) });
check(size === 36, 'Pinch must respect maximum font size');
emit('touchcancel', {});
check(!pinching, 'Cancelled touch must release the pinch state');
emit('touchmove', { touches: touches(100) });
check(size === 36, 'Cancelled gestures must not continue changing text');
const single = emit('touchstart', { touches: [{ clientX: 0, clientY: 0 }] });
check(!single.defaultPrevented, 'One-finger scrolling must remain available');
dispose();
emit('wheel', { altKey: true, deltaY: 80, deltaMode: 0 });
check(size === 36, 'Unmount must remove input listeners');
