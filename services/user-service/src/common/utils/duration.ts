export function parseDurationToMs(value: string): number {
  // Supports: "60s", "15m", "1h", "7d" (case-insensitive). Also supports plain numbers as milliseconds.
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Duration is empty');

  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed);
    if (!Number.isFinite(ms) || ms < 0) throw new Error(`Invalid duration: ${value}`);
    return ms;
  }

  const match = /^([0-9]+)\s*([smhd])$/i.exec(trimmed);
  if (!match) throw new Error(`Invalid duration: ${value}`);

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * multiplier;
}
