// The page's one AudioContext. It lives as long as the page does, so the soundtrack keeps playing while you move between pages
// (the layout, and the sound control in it, stay mounted), and the slide sounds play through the same context.

let context = null;

/** The context, made on first use (from a click or key press, since browsers only allow audio after one). Null where there is no Web Audio. */
export function audioContext() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  context ??= new Context();
  return context;
}

/** The context if one has been made; never makes one. Null before the soundtrack has been switched on (and outside the app, in Storybook). */
export const existingAudioContext = () => context;
