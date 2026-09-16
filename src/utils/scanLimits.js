// A hard ceiling on how many pages a single document (scan or merge) can
// contain, so no single PDF build/rasterize pass on a low-end device can run
// long enough to feel broken or exhaust memory.
export const MAX_PAGES_PER_DOCUMENT = 50;
