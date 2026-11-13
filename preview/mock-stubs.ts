// Browser preview only: inert stand-ins for the Tauri plugins.
export const getCurrentWindow = () => {
  throw new Error("no window in the browser preview");
};
export const getVersion = async () => "0.2.0";
export const listen = async () => () => {};
export const open = async () => null;
export const save = async () => null;
export const relaunch = async () => {};
export const check = async () => null;
export type Update = never;
