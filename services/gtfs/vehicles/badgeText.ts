const MAX_FULL = 4;
const CUT_TO = 3;

/** What fits in a vehicle's badge: short names as they are, longer ones cut to their first letters. */
export const badgeText = (routeName: string) => (routeName.length <= MAX_FULL ? routeName : routeName.slice(0, CUT_TO));
