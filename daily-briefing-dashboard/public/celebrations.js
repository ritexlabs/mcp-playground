// ─── Celebrations Card ────────────────────────────────────────────────────────

const BIRTHDAY_GIFS = [
  "https://media.giphy.com/media/26xBI74a9wVMYFNCY/giphy.gif",
  "https://media.giphy.com/media/l4FGuhL4U2Ap5DQKY/giphy.gif",
  "https://media.giphy.com/media/g5R9dok94mrIvplmZd/giphy.gif",
];
const ANNIVERSARY_GIFS = [
  "https://media.giphy.com/media/3oz8xRtfn10QxuFPdC/giphy.gif",
  "https://media.giphy.com/media/l0HlMSvdSJQT3TUNI/giphy.gif",
];

function getBirthdayMessages(name) {
  return [
    `🎂 Happy Birthday, ${name}! 🎉\nWishing you a day filled with joy, laughter, and love. May this new year of your life bring you endless happiness and all your dreams come true! 🌟`,
    `🎈 Many happy returns of the day, ${name}! 🥳\nHope your special day is absolutely amazing! Wishing you all the love, fun, and celebration you deserve. Enjoy every moment! 🎁✨`,
    `🎂 Wishing you a very Happy Birthday, ${name}!\nMay all your birthday wishes come true and may this year be your best one yet. Have a wonderful, joy-filled day! 🥂🎊`,
  ];
}

function getAnniversaryMessages(name, subType) {
  if (subType === "work-anniversary") {
    return [
      `🎉 Happy Work Anniversary, ${name}! 👏\nYour dedication and hard work make such a difference every single day. Wishing you continued success and many more wonderful years ahead!`,
      `🏆 Congratulations on your work anniversary, ${name}!\nThank you for everything you bring to the table. Here's to many more years of growth and achievement! 💫`,
      `⭐ Happy work milestone, ${name}! 🎊\nTime flies when you're making an impact. Wishing you more success, growth, and amazing opportunities ahead!`,
    ];
  }
  return [
    `💕 Happy Anniversary, ${name}! 🥂\nWishing you a beautiful day filled with love and cherished memories. May your bond grow stronger and more beautiful with each passing year! ❤️`,
    `🌹 Congratulations on your anniversary, ${name}!\nMay your love story continue to inspire everyone around you. Here's to many more wonderful years together! 👑`,
    `💖 Happy Anniversary, ${name}! 🎊\nMay this special day be filled with beautiful moments and blessings for the beautiful journey ahead together! 🌊`,
  ];
}

function renderCelebrations(celebrations) {
  const el = DOM.celebrationsContent;
  const countEl = DOM.celebrationsCount;
  if (!el) return;

  if (!Array.isArray(celebrations) || celebrations.length === 0) {
    if (countEl) countEl.textContent = "none today";
    el.innerHTML = `
      <div class="no-celebrations">
        <span class="no-cel-icon">🌞</span>
        <p>No birthdays or anniversaries today.</p>
        <p class="no-cel-sub">Enjoy your day!</p>
      </div>`;
    return;
  }

  if (countEl) countEl.textContent = `${celebrations.length} today`;

  el.innerHTML = celebrations.map((cel, idx) => {
    const isBirthday = cel.type === "birthday";
    const gifs = isBirthday ? BIRTHDAY_GIFS : ANNIVERSARY_GIFS;
    const gif = gifs[idx % gifs.length];
    const messages = isBirthday
      ? getBirthdayMessages(cel.name)
      : getAnniversaryMessages(cel.name, cel.subType);
    const emoji = isBirthday ? "🎂" : (cel.subType === "work-anniversary" ? "🏆" : "💝");
    const typeLabel = isBirthday ? "Birthday"
      : (cel.subType === "work-anniversary" ? "Work Anniversary" : "Anniversary");
    const typeClass = isBirthday ? "cel-birthday" : "cel-anniversary";
    const gifSearch = `https://giphy.com/search/${encodeURIComponent(isBirthday ? "happy birthday" : "happy anniversary")}`;

    return `
    <div class="celebration-item" id="cel-item-${idx}">
      <div class="cel-header">
        <div class="cel-person">
          <span class="cel-emoji">${emoji}</span>
          <span class="cel-name">${escHtml(cel.name)}</span>
          <span class="cel-type-badge ${typeClass}">${typeLabel}</span>
        </div>
        <a href="${gifSearch}" target="_blank" rel="noopener" class="gif-search-btn" title="Find a GIF to share on Giphy">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="13" height="13">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          Find GIF
        </a>
      </div>

      <div class="cel-gif-wrap">
        <img src="${gif}"
             alt="${typeLabel} GIF for ${escHtml(cel.name)}"
             class="cel-gif"
             loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="cel-gif-fallback" style="display:none">
          <span>${emoji}</span>
        </div>
      </div>

      <div class="cel-messages">
        <div class="cel-messages-header">
          <span class="cel-messages-label">📋 Ready Wishes:</span>
          <div class="cel-wish-tabs">
            <button class="wish-tab-btn active" onclick="switchWishTab(${idx}, 0)" type="button">Wish 1</button>
            <button class="wish-tab-btn" onclick="switchWishTab(${idx}, 1)" type="button">Wish 2</button>
            <button class="wish-tab-btn" onclick="switchWishTab(${idx}, 2)" type="button">Wish 3</button>
          </div>
        </div>
        ${messages.map((msg, mi) => `
          <div class="cel-message-item ${mi === 0 ? 'active' : ''}" id="cel-msg-${idx}-${mi}">
            <pre class="cel-message-text">${escHtml(msg)}</pre>
            <button class="cel-copy-btn" onclick="copyMessage('cel-msg-${idx}-${mi}')" title="Copy to clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="13" height="13">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
              </svg>
              Copy
            </button>
          </div>`).join("")}
      </div>
    </div>
    \${idx < celebrations.length - 1 ? '<div class="cel-divider"></div>' : ''}`;
  }).join("");
}

window.switchWishTab = function(celIdx, wishIdx) {
  const celItem = document.getElementById(`cel-item-${celIdx}`);
  if (!celItem) return;

  const tabs = celItem.querySelectorAll(".wish-tab-btn");
  const panes = celItem.querySelectorAll(".cel-message-item");

  tabs.forEach((tab, index) => {
    if (index === wishIdx) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  panes.forEach((pane, index) => {
    if (index === wishIdx) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });
};

function copyMessage(itemId) {
  const item = document.getElementById(itemId);
  if (!item) return;
  const text = item.querySelector(".cel-message-text")?.textContent || "";
  navigator.clipboard.writeText(text).then(() => {
    const btn = item.querySelector(".cel-copy-btn");
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Copied!`;
    btn.classList.add("copied");
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 2000);
  });
}
