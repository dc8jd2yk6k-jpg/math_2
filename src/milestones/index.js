import { shannon } from './shannon.js';
import { deepblue } from './deepblue.js';
import { alphago } from './alphago.js';
import { imo2024, imo2025 } from './imo.js';
import { erdos } from './erdos.js';
import { jacobian } from './jacobian.js';
import { percolation } from './percolation.js';
import { navierstokes } from './navierstokes.js';
import { manuscripts } from './manuscripts.js';
import { yangmills } from './yangmills.js';
import { ethOpenAI, ethClaude } from './eth.js';
import { pullback } from './pullback.js';
import { decades } from './decades.js';
import { chessera } from './chessera.js';
import { gates } from './gates.js';

export function createMilestones(ctx) {
  return [
    shannon(ctx), deepblue(ctx), alphago(ctx), imo2024(ctx), imo2025(ctx), erdos(ctx), jacobian(ctx), percolation(ctx),
    navierstokes(ctx), manuscripts(ctx), yangmills(ctx), ethOpenAI(ctx), ethClaude(ctx), pullback(ctx), decades(ctx),
    chessera(ctx), gates(ctx),
  ];
}
