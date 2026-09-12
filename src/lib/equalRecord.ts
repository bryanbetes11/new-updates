export function equalRecord<T>(left: Record<string, T>, right: Record<string, T>, equal: (a: T, b: T) => boolean = Object.is): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && equal(left[key], right[key]));
}
