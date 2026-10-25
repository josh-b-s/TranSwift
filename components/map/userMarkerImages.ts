// Arrow plus heading cone, one image per compass calibration level (0 worst, 3 best).
// expo-location gives a level, not degrees, so cone half-angles are 80, 50, 30 and 15.
const BY_LEVEL = [
    require('../../assets/images/user-marker/level-0.png'),
    require('../../assets/images/user-marker/level-1.png'),
    require('../../assets/images/user-marker/level-2.png'),
    require('../../assets/images/user-marker/level-3.png'),
];
const NO_HEADING = require('../../assets/images/user-marker/none.png');

/** The marker image for a compass reading, or the bare arrow when there's no reading yet. */
export const userMarkerImage = (accuracyLevel: number | null) =>
    accuracyLevel === null ? NO_HEADING : (BY_LEVEL[accuracyLevel] ?? BY_LEVEL[0]);
