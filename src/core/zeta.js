// The Riemann zeta function on the critical strip, by Euler–Maclaurin summation:
//   ζ(s) = Σ_{n<N} n^-s + N^(1-s)/(s-1) + N^-s/2 + Σ_k B_2k/(2k)! · s(s+1)…(s+2k-2) · N^(-s-2k+1)
// With N = 30 and twelve Bernoulli terms it is accurate to ~1e-12 for |Im s| <= 60.
const BERN = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510, 43867 / 798, -174611 / 330, 854513 / 138, -236364091 / 2730];

const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
// n^-s = exp(-s ln n)
const npow = (n, s) => { const l = Math.log(n), m = Math.exp(-s[0] * l), a = -s[1] * l; return [m * Math.cos(a), m * Math.sin(a)]; };

export function zeta(sr, si, N = 30) {
  const s = [sr, si];
  let re = 0, im = 0;
  for (let n = 1; n < N; n++) { const p = npow(n, s); re += p[0]; im += p[1]; }
  const Ns = npow(N, s);                     // N^-s
  const N1s = [Ns[0] * N, Ns[1] * N];        // N^(1-s)
  const t1 = div(N1s, [sr - 1, si]);
  re += t1[0] + Ns[0] / 2; im += t1[1] + Ns[1] / 2;
  // Bernoulli tail: term_k = B_2k/(2k)! * prod_{j=0}^{2k-2} (s+j) * N^(-s-2k+1)
  let rising = [sr, si];                     // s(s+1)…(s+2k-2), starting at k = 1
  let Npow = [Ns[0] / N, Ns[1] / N];         // N^(-s-1)
  let fact = 2;                              // (2k)!
  for (let k = 1; k <= BERN.length; k++) {
    const term = mul(rising, Npow);
    re += (BERN[k - 1] / fact) * term[0]; im += (BERN[k - 1] / fact) * term[1];
    rising = mul(mul(rising, [sr + 2 * k - 1, si]), [sr + 2 * k, si]);
    Npow = [Npow[0] / (N * N), Npow[1] / (N * N)];
    fact *= (2 * k + 1) * (2 * k + 2);
  }
  return [re, im];
}

// the first ten nontrivial zeros, 1/2 + i·t
export const ZEROS = [14.134725142, 21.022039639, 25.010857580, 30.424876126, 32.935061588, 37.586178159, 40.918719012, 43.327073281, 48.005150881, 49.773832478];
