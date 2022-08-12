export class Vec {
  static const(length, x) {
    return new Array(length).fill(x);
  }
  static zeros(length) {
    return Vec.const(length, 0);
  }
  static ones(length) {
    return Vec.const(length, 1);
  }

  static clone(a) {
    return [...a];
  }
  static length(a) {
    return Math.hypot(...a);
  }

  static unaryOp(a, op) {
    return a.map(op);
  }

  static binaryOp(a, b, op) {
    if (a.length !== b.length) {
      throw new DimensionMismatchError();
    }
    const out = Vec.zeros(a.length);
    for (let i = 0; i < a.length; i++) {
      out[i] = op(a[i], b[i]);
    }
    return out;
  }

  static all(a) {
    return a.every((a) => a);
  }
  static any(a) {
    return a.some((a) => a);
  }
  static none(a) {
    return a.every((a) => !a);
  }

  static floor(a) {
    return Vec.unaryOp(a, Math.floor);
  }
  static ceil(a) {
    return Vec.unaryOp(a, Math.ceil);
  }
  static round(a) {
    return Vec.unaryOp(a, Math.round);
  }
  static add(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a + b);
  }
  static sub(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a - b);
  }
  static mul(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a * b);
  }
  static div(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a / b);
  }
  static mod(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a % b);
  }
  static min(a, b) {
    return Vec.binaryOp(a, b, Math.min);
  }
  static max(a, b) {
    return Vec.binaryOp(a, b, Math.max);
  }

  static eq(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a === b);
  }
  static neq(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a !== b);
  }
  static approx(a, b, eps) {
    return Vec.binaryOp(a, b, (a, b) => Math.abs(a - b < eps));
  }
  static lt(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a < b);
  }
  static gt(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a > b);
  }
  static leq(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a <= b);
  }
  static geq(a, b) {
    return Vec.binaryOp(a, b, (a, b) => a >= b);
  }

  static mulElements(a) {
    return a.reduce((x, y) => x * y);
  }

  static sumElements(a) {
    return a.reduce((x, y) => x + y);
  }

  static dot(a, b) {
    return Vec.sumElements(Vec.mul(a, b));
  }

  static linearIndex(index, dimensions) {
    const dims = Vec.clone(dimensions);
    let scale = 1;
    for (let i = 0; i < dims.length; i++) {
      dims[i] = scale;
      scale *= dimensions[i];
    }
    return Vec.sumElements(Vec.mul(index, dims));
  }

  static *lexi(a) {
    const b = new Array(a.length).fill(0);
    const count = a.reduce((a, b) => a * b);
    for (let j = 0; j < count; j++) {
      yield [...b];
      for (let i = 0; i < b.length; i++) {
        b[i]++;
        if (b[i] >= a[i]) {
          b[i] = 0;
        } else {
          break;
        }
      }
    }
  }
}
