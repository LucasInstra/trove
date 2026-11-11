/**
 * Feature switches that keep a piece of the app in the tree without showing it.
 *
 * The keeper is parked while the planner takes the focus. Nothing was deleted:
 * the component, the customisation sheet and the settings are all still here.
 * Flip this to true to bring the keeper back in the rail, the forecast card and
 * the import screen.
 */
export const SHOW_KEEPER = false;

/**
 * The forecast card kept the keeper as its illustration, drawn bare. Parked for
 * now, at the user's request, while the cards get the attention.
 */
export const SHOW_HERO_KEEPER = false;
