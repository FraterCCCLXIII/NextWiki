/* Which sound goes with which logo.
   1: jingle 1, the music builds and the word comes late, for reveals where the shapes come first.
   2: jingle 2, the word comes straight away, for reveals where the word appears early.
   3: jingle 1's music only. 4: jingle 2's swell only. Neither has any voice. */
const MUSIC_ONLY = { 28: 3, 36: 3, 42: 3, D05: 3, 16: 4, 62: 4, 38: 4, C05: 4 };
export const WORD_FIRST = ["33", "18", "C03", "30", "57", "31", "D02"];
export const jingleFor = (id) => MUSIC_ONLY[id] || (WORD_FIRST.includes(id) ? 2 : 1);
