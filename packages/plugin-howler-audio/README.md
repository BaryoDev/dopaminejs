# dopaminejs-plugin-howler-audio

Howler.js as the sound part for DopamineJS.

```javascript
import { createDopamine } from 'dopaminejs';
import { howlerSound } from 'dopaminejs-plugin-howler-audio';

const sound = howlerSound({ sounds: { xp: '/xp.mp3' } });
createDopamine({ sound });
```

## Music channel

Tracks are looping songs kept apart from the short sounds. Switching tracks
never restarts a song: fading out pauses it, and playing it again resumes from
the same place. Only the first play of a track starts at the beginning.

```javascript
sound.registerTrack('menu', ['/menu.ogg', '/menu.mp3'], { volume: 0.8 });
sound.registerTrack('game', '/game.mp3');

sound.playTrack('menu', { fadeIn: 1600 });

// Menu fades out over 1400 ms, game fades in over 1600 ms
// (900 ms if it was already playing).
sound.crossfade('menu', 'game', { out: 1400, in: 1600, inIfPlaying: 900 });

sound.duckMusic(0.3, 200);   // lower the music under a voice line
sound.unduck(400);

sound.setMusicVolume(0.5);   // tracks only
sound.setEffectsVolume(0.8); // sounds added with register() only

sound.muteMusic(500);        // fades to silence, the song keeps its place
sound.unmuteMusic(1200);

sound.getTrackPosition('game'); // seconds
sound.getMusicVolume();
sound.getEffectsVolume();
```

Track and duck fades use `smoothstep` by default (`k * k * (3 - 2 * k)`). Pass
`curve: 'linear'` for a straight line. Mute and unmute fades are always linear.
Fades run on `requestAnimationFrame` raced against a 100 ms timer, so they
still finish in a hidden tab. Where there is no `requestAnimationFrame` they use a 16 ms timer.
A track played before the first user gesture waits for Howler to unlock, and
plays once then. Tests can pass their own
`clock: { now, request, cancel }` to `howlerSound()`.

`fadeOutTrack(key, ms, curve)` fades one track out and pauses it.
A second `crossfade` cancels the first.
The existing methods (`register`, `play`, `setVolume`, `setMuted` and the
rest) behave as before. `setVolume` still sets Howler's global volume.
