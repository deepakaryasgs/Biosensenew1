// Regression utilities for calibration curves.
// Input points: array of { x: concentration, y: absorbance } OR vice versa per usage.
export interface Point { x: number; y: number }

export interface RegressionResult {
  type: 'linear' | 'polynomial' | 'manual';
  degree: number;
  coefficients: number[]; // [a0, a1, a2, ...] y = a0 + a1 x + a2 x^2 ...
  r2: number;
  equation: string;
  predict: (x: number) => number;
  inverse: (y: number) => number | null; // returns x given y (for concentration from absorbance)
}

export function linearRegression(points: Point[]): RegressionResult {
  const n = points.length;
  if (n < 2) {
    return makeResult('linear', [0, 0], 0, points);
  }
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const meanY = sumY / n;
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return makeResult('linear', [intercept, slope], r2, points);
}

// Polynomial regression using normal equations (Gaussian elimination)
export function polynomialRegression(points: Point[], degree: number): RegressionResult {
  const n = points.length;
  if (n < degree + 1) return linearRegression(points);
  const m = degree + 1;
  // Build matrix A and vector b for A * coeffs = b
  const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  const b: number[] = new Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      A[i][j] = points.reduce((s, p) => s + Math.pow(p.x, i + j), 0);
    }
    b[i] = points.reduce((s, p) => s + Math.pow(p.x, i) * p.y, 0);
  }
  const coeffs = gaussianSolve(A, b);
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const predict = (x: number) => coeffs.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
  const ssRes = points.reduce((s, p) => s + (p.y - predict(p.x)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return makeResult('polynomial', coeffs, r2, points, degree);
}

function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    if (M[i][i] === 0) continue;
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = M[i][i] === 0 ? 0 : s / M[i][i];
  }
  return x;
}

function formatEquation(coeffs: number[]): string {
  const terms: string[] = [];
  coeffs.forEach((c, i) => {
    if (Math.abs(c) < 1e-9 && i > 0) return;
    const v = c.toPrecision(4);
    if (i === 0) terms.push(`${v}`);
    else if (i === 1) terms.push(`${c >= 0 ? '+' : ''}${v}x`);
    else terms.push(`${c >= 0 ? '+' : ''}${v}x^${i}`);
  });
  return `y = ${terms.join(' ')}`;
}

function makeResult(
  type: 'linear' | 'polynomial' | 'manual',
  coefficients: number[],
  r2: number,
  points: Point[],
  degree?: number,
): RegressionResult {
  const deg = degree ?? coefficients.length - 1;
  const predict = (x: number) => coefficients.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
  const inverse = (y: number): number | null => {
    if (deg === 1) {
      if (coefficients[1] === 0) return null;
      return (y - coefficients[0]) / coefficients[1];
    }
    // Numeric inversion: bisection over range from points
    if (points.length === 0) return null;
    const xs = points.map((p) => p.x);
    let lo = Math.min(...xs);
    let hi = Math.max(...xs);
    if (lo === hi) return lo;
    // Expand range a bit
    const span = hi - lo;
    lo -= span;
    hi += span;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const v = predict(mid);
      if (predict(lo) <= predict(hi)) {
        if (v < y) lo = mid; else hi = mid;
      } else {
        if (v > y) lo = mid; else hi = mid;
      }
    }
    return (lo + hi) / 2;
  };
  return {
    type,
    degree: deg,
    coefficients,
    r2,
    equation: formatEquation(coefficients),
    predict,
    inverse,
  };
}

export function manualLinear(slope: number, intercept: number): RegressionResult {
  return makeResult('manual', [intercept, slope], 1, []);
}
