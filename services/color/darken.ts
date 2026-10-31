/** A hex colour ("#rgb", "#rrggbb", with or without the "#") with each channel scaled down by `amount` (0 to 1). Anything else comes back unchanged. */
export function darken(color: string, amount: number): string {
    const hex = color.replace(/^#/, '');
    const full = /^[0-9a-f]{3}$/i.test(hex) ? hex.replace(/./g, c => c + c) : hex;
    if (!/^[0-9a-f]{6}$/i.test(full)) return color;
    const scale = 1 - amount;
    const channels = [0, 2, 4].map(i => Math.round(parseInt(full.slice(i, i + 2), 16) * scale));
    return '#' + channels.map(c => c.toString(16).padStart(2, '0')).join('');
}
