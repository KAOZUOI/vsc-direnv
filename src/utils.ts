'use strict';

/**
 * Assigns properties from one object to another
 */
export function assign(target: any, source: any): any {
  Object.keys(source).forEach(key => {
    target[key] = source[key];
  });
  return target;
}
