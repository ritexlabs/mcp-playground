// Fallback wish message templates.
// Edit this file to customise messages without touching component code.
// Each entry is a function that receives the person's name and returns a string.

export const BIRTHDAY = [
  n => `🎂 Happy Birthday, ${n}! 🎉\nWishing you a day filled with joy, laughter, and love. May this new year of your life bring you endless happiness and all your dreams come true! 🌟`,
  n => `🎈 Many happy returns of the day, ${n}! 🥳\nHope your special day is absolutely amazing! Wishing you all the love, fun, and celebration you deserve. Enjoy every moment! 🎁✨`,
  n => `🎂 Wishing you a very Happy Birthday, ${n}!\nMay all your birthday wishes come true and may this year be your best one yet. Have a wonderful, joy-filled day! 🥂🎊`,
]

export const ANNIVERSARY = [
  n => `💕 Happy Anniversary, ${n}! 🥂\nWishing you a beautiful day filled with love and cherished memories. May your bond grow stronger and more beautiful with each passing year! ❤️`,
  n => `🌹 Congratulations on your anniversary, ${n}!\nMay your love story continue to inspire everyone around you. Here's to many more wonderful years together! 👑`,
  n => `💖 Happy Anniversary, ${n}! 🎊\nMay this special day be filled with beautiful moments and blessings for the beautiful journey ahead together! 🌊`,
]

export const WORK_ANNIVERSARY = [
  n => `🎉 Happy Work Anniversary, ${n}! 👏\nYour dedication and hard work make such a difference every single day. Wishing you continued success and many more wonderful years ahead!`,
  n => `🏆 Congratulations on your work anniversary, ${n}!\nThank you for everything you bring to the table. Here's to many more years of growth and achievement! 💫`,
  n => `⭐ Happy work milestone, ${n}! 🎊\nTime flies when you're making an impact. Wishing you more success, growth, and amazing opportunities ahead!`,
]

export function getFallbackMessages(name, type, subType) {
  if (type === 'birthday')             return BIRTHDAY.map(t => t(name))
  if (subType === 'work-anniversary')  return WORK_ANNIVERSARY.map(t => t(name))
  return ANNIVERSARY.map(t => t(name))
}
