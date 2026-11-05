/* Which jingle goes with which logo. Jingle 1 builds and says the word late, so it suits reveals where the shapes come
   first. Jingle 2 says the word straight away, so it suits reveals where the word appears early. */
export const WORD_FIRST = ["33", "18", "C03", "30", "57", "31", "C05", "D02", "D05", "62"];
export const jingleFor = (id) => (WORD_FIRST.includes(id) ? 2 : 1);
