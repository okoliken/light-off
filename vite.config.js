// Dev server for playing locally. Hot reload is off: an auto-reload mid-game (after the laptop sleeps,
// or when the connection blips) would throw the player back to the title screen.
export default {
  server: { hmr: false },
};
