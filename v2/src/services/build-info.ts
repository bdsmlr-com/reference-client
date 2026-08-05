export const UNKNOWN_BUILD_TAG = 'staging@unknown-unknown';

export const BUILD_TAG: string = import.meta.env?.VITE_BUILD_SHA || UNKNOWN_BUILD_TAG;
