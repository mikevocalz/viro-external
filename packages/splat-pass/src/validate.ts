import type { SplatPassOpts } from './types';
export function validateSplatOptions(opts: SplatPassOpts): void {
  if (!opts || !Number.isSafeInteger(opts.sceneNavTag) || opts.sceneNavTag <= 0) throw new Error('A positive native scene navigator tag is required');
  if (!opts.source || typeof opts.source.uri !== 'string' || !opts.source.uri.trim()) throw new Error('A splat source URI is required');
  if (opts.source.format !== 'spz') throw new Error('This native pass currently supports static SPZ only; 4D decoding is not integrated');
  if (opts.getTimestamp) throw new Error('Native audio-clock/4D playback is not integrated; getTimestamp cannot be silently ignored');
  if (opts.priority !== undefined && (!Number.isInteger(opts.priority) || opts.priority < -2147483648 || opts.priority > 2147483647)) throw new Error('Priority must be an int32');
  const max = opts.quality?.maxSplats;
  if (max !== undefined && (!Number.isSafeInteger(max) || max < 0 || max > 2147483647)) throw new Error('maxSplats must be 0..2147483647 (native int32)');
  if (opts.quality?.frameBudgetMs !== undefined || opts.quality?.throttleAfterFrames !== undefined) throw new Error('Adaptive GPU-budget throttling is not integrated in this native pass');
}
