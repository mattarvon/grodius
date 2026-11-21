# Recording the booth with a Blue Yeti (Windows 11)

The booth's README sets up a laptop mic on PipeWire. This page is for a Blue Yeti USB mic on Windows 11 in the booth.
The goal is the same: a raw take that peaks around -12 to -6 dBFS, never clipped.

## Why the level matters

- The chain (`tools/booth/plugin.ts`, `VOX`) brings every take to **-12 LUFS** (`VOX.lufs`) with gain.
- A take that needs more than **+18 dB** of gain (`VOX.quiet`) gets a **quiet take** warning. The gain brings the room's hiss up with it, so the fix is at the mic, not in the chain.
- Recent takes needed **+19 to +29 dB**. Every one of them was a quiet take. Get the level right at the mic and the hiss stays down.
- A raw peak at **-0.5 dBFS or above** (`VOX.clipAt`) is refused. No processing can undo clipping.
- A raw peak past **-3 dBFS** (`VOX.hotAt`) gets a hot-take warning.

## Pattern and position

- Set the Yeti to **cardioid**. Cardioid picks up sound from the front and rejects the rear and sides, which suits
  one voice in a room with a fan and a keyboard. Logitech's Yeti Pro manual describes cardioid this way for vocals and
  voiceovers ([Logitech Yeti Pro manual](https://www.logitech.com/assets/70001/yetipro_manual_english.ENG.pdf)).
- Speak into the **front** of the capsule, the side with the Blue logo, not the top. Don't talk across the top edge.
- Distance: start at the README's **20-30 cm**. Off-axis, slightly to one side, is fine and softens plosives.
- Use a **pop filter**, or stay slightly off-axis, to keep P and B bursts from peaking the meter.
- Keep the mic off the desk and away from the keyboard so the key clicks land quiet.

## Set the level

1. **Windows input level first.** Settings > System > Sound > Input, choose the Yeti, and set the input volume to a
   starting point (one guide suggests 60-80; treat that as a rule of thumb, not a spec). Keep it fixed for the session.
2. **Hardware gain knob on the Yeti is the main control.** Start it low-to-middle and read the booth's meter.
   Turning it up raises sensitivity; if you hear digital distortion on loud sounds, turn it down (Logitech's Yeti Pro
   manual gives the same direction).
3. **Read a test line.** The loudest syllable belongs at **-12 to -6 dBFS** on the booth's meter (the marked band).
   - Below -14: raise the gain a little.
   - Past -3 (HOT): lower the gain.
   - CLIP lights at **-0.5**: that take is refused. Lower the gain and record again.
4. Set the Windows slider and the knob once, then use the knob for small changes. Setting both high adds noise and clipping.

## Windows 11 settings

- **Disable audio enhancements.** Settings > System > Sound > Input > the Yeti > Audio enhancements (or the device
  properties) off. Enhancements are a noise-reduction layer, and an Audacity user reported a Yeti losing the first
  fraction of a second of speech with them on
  ([Audacity forum report](https://forum.audacityteam.org/t/audacity-missing-first-1-4-second-of-speech-with-blue-yeti/90089)).
- **Check microphone privacy.** If the Yeti shows activity but the booth records nothing, allow the browser under
  Privacy & security > Microphone.
- Use `localhost` in the browser, as the README says. The booth asks for the mic; choose the Yeti in its header.
- Pick the Yeti's plain input device (Windows lists it as the Yeti's "Stereo Microphone"), not a virtual or
  "enhanced" device. The booth wants the raw input.

## Monitoring

- Plug headphones into the Yeti's headphone jack, not the PC's, and set the Yeti's headphone volume knob. The Yeti's
  monitor path is hardware, so you hear the mic without software latency
  ([Logitech Yeti Pro manual](https://www.logitech.com/assets/70001/yetipro_manual_english.ENG.pdf) describes the
  headphone jack for real-time monitoring).
- Monitoring loudness is separate from the gain. Adjust what you hear with the headphone knob, never with the gain.

## Recording rhythm

- Wait about **0.5 s after Space** before the first word. The booth's denoise learns the room from that lead-in.
- The stop key's click is found and cut automatically (30-90 ms on the Yeti; `tools/booth/names.ts` clickTail).
- Leave **about 0.3 s of silence after the last word** before you press Space to stop. The tail is kept (0.25 s,
  `VOX.tail`), and the click cut needs room to find the end of the word.
- Keep one breath between caption lines. With the booth's "shorten pauses" box ticked, pauses over 0.4 s are cut to 0.25 s when the take is kept.

## If it still goes wrong

- Still quiet at +18 dB or more: move closer (inside 30 cm) or raise the gain, then record again.
- Hiss or a pumping, gated voice: check that no enhancement or Windows noise module is on.
- Clipped: lower the gain. The raw file is kept in `assets-raw/voice/<folder>/`, so re-record rather than process.
