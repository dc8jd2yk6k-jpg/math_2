import { placeholder } from './placeholder.js';

export function createMilestones(ctx) {
  return [
    ['deepblue', 'IBM Deep Blue'], ['alphago', 'AlphaGo'], ['imo2024', 'AlphaProof + AlphaGeometry 2'],
    ['imo2025', 'Gemini Deep Think'], ['erdos', 'OpenAI'], ['jacobian', 'Claude'], ['percolation', 'Anthropic'],
    ['navierstokes', 'OpenAI'], ['manuscripts', 'OpenAI'], ['yangmills', 'OpenAI'], ['eth_openai', 'OpenAI'], ['eth_claude', 'Claude'],
  ].map(([id, label]) => placeholder(ctx, id, label));
}
