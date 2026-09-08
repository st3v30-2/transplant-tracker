
// =========================================
// RIDGEWOOD OR BUSHWICK?
// GAME ENGINE
// =========================================

const GAME_NAME = "Transplant Tracker";

const QUESTION_COUNT = 8;

const CORRECT_MESSAGES = [
  `Right! Keep it going!`,
  `Correct! You seem to know your way around!`,
  `Good job! Celebrate by cracking a brew at Billy's Birreria!`,
  `You got it! This will look great on your Hinge profile.`,
  `Nice! Reward yourself with a Light Blue American Spirit outside TV Eye.`,
  `Yes! Yes! Oh god, yes! Don’t Stop!`,
  `You’re right! You’ve earned the right to complain that Ridgewood was better six months before you moved here.`,
  `Wow! Are you Zohran Mamdani? Please be honest if you are. Also DM us back.`
];

const INCORRECT_MESSAGES = [
  `Incorrect! Try looking up from your phone every once in a while!`,
  `Wrong! What, did your mother never teach you about boundaries?`,
  `Try Again! You wouldn’t know Bushwick from your own damn bush (pubic hair)!`,
  `Missed Again! Are you “Ridgewood Sober” right now?`,
  `Nope! Are you sure you’re not thinking of New Jersey?`,
  `Yikes! I wouldn’t show my face on the L train if I were you!`,
  `Brutal! You can’t feel good about the decisions you’ve made in life that have led you here.`,
  `Wrong again! Are you fucking stupid?`
];

const SEEN_STORAGE_KEY =
  "ridgewood-or-bushwick-seen-v1";

// Replace this one value when the game
// has its real public URL.
const GAME_URL =
  "https://st3v30-2.github.io/transplant-tracker/";

document.title = GAME_NAME;

// -----------------------------------------
// DOM
// -----------------------------------------

const startScreen =
  document.getElementById("startScreen");

const gameScreen =
  document.getElementById("gameScreen");

const resultsScreen =
  document.getElementById("resultsScreen");

const beginButton =
  document.getElementById("beginButton");

const ridgewoodButton =
  document.getElementById("ridgewoodButton");

const bushwickButton =
  document.getElementById("bushwickButton");

const nextButton =
  document.getElementById("nextButton");

const playAgainButton =
  document.getElementById("playAgainButton");

const shareButton =
  document.getElementById("shareButton");

const gamePhoto =
  document.getElementById("gamePhoto");

const photoLoading =
  document.getElementById("photoLoading");

const photoSource =
  document.getElementById("photoSource");

const questionProgress =
  document.getElementById("questionProgress");

const feedbackPanel =
  document.getElementById("feedbackPanel");

const answerArea =
  document.getElementById("answerArea");

const feedbackIcon =
  document.getElementById("feedbackIcon");

const feedbackTitle =
  document.getElementById("feedbackTitle");

const feedbackText =
  document.getElementById("feedbackText");

const finalScore =
  document.getElementById("finalScore");

const resultHeadline =
  document.getElementById("resultHeadline");

const resultMessage =
  document.getElementById("resultMessage");

const scoreTracker =
  document.getElementById("scoreTracker");

const scoreDots =
  Array.from(
    document.querySelectorAll(
      "#scoreTracker .score-dot"
    )
  );

const finalScoreTracker =
  document.getElementById(
    "finalScoreTracker"
  );

const copyConfirmation =
  document.getElementById(
    "copyConfirmation"
  );

const announcer =
  document.getElementById("announcer");

// -----------------------------------------
// STATE
// -----------------------------------------

let manifest = null;
let questions = [];
let currentIndex = 0;
let score = 0;
let answers = [];
let acceptingAnswer = false;

let correctMessageIndex = 0;
let incorrectMessageIndex = 0;

// -----------------------------------------
// HELPERS
// -----------------------------------------

function setButtonText(button, text) {
  const label =
    button.querySelector(
      ".ui-jitter-label, .choice-label"
    );

  if (label) {
    label.textContent = text;
  } else {
    button.textContent = text;
  }
}


function shuffle(array) {
  const copy = [...array];

  for (
    let i = copy.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      copy[i],
      copy[j]
    ] = [
      copy[j],
      copy[i]
    ];
  }

  return copy;
}

function randomItem(array) {
  if (!array.length) {
    return null;
  }

  return array[
    Math.floor(
      Math.random() * array.length
    )
  ];
}

function otherSource(source) {
  return source === "Mapillary"
    ? "KartaView"
    : "Mapillary";
}

function preferredSource() {
  const configuredWeight =
    Number(
      manifest
        ?.sourceWeights
        ?.Mapillary
    );

  const weight =
    Number.isFinite(configuredWeight)
      ? configuredWeight
      : 0.8;

  return Math.random() < weight
    ? "Mapillary"
    : "KartaView";
}

// -----------------------------------------
// SCREENS
// -----------------------------------------

function showOnly(screen) {
  startScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");
  resultsScreen.classList.add("hidden");

  screen.classList.remove("hidden");

  window.scrollTo(0, 0);
}

// -----------------------------------------
// SEEN PHOTO HISTORY
// -----------------------------------------

function getSeenIds() {
  try {
    const value =
      localStorage.getItem(
        SEEN_STORAGE_KEY
      );

    if (!value) {
      return new Set();
    }

    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? new Set(parsed)
      : new Set();

  } catch {
    return new Set();
  }
}

function saveSeenIds(seen) {
  try {
    localStorage.setItem(
      SEEN_STORAGE_KEY,
      JSON.stringify([...seen])
    );
  } catch {
    // Game still works without storage.
  }
}

function markQuestionsSeen() {
  const seen =
    getSeenIds();

  for (const photo of questions) {
    seen.add(photo.id);
  }

  saveSeenIds(seen);
}

// -----------------------------------------
// NEIGHBORHOOD DISTRIBUTION
// -----------------------------------------

function chooseNeighborhoodTargets() {
  const options =
    Array.isArray(
      manifest?.neighborhoodSplits
    )
      ? manifest.neighborhoodSplits
      : [
          [4, 4],
          [5, 3],
          [6, 2]
        ];

  const chosen =
    randomItem(options) || [4, 4];

  let ridgewood =
    Number(chosen[0]);

  let bushwick =
    Number(chosen[1]);

  // Randomly determine which neighborhood
  // gets the larger share in 5/3 or 6/2 games.
  if (
    ridgewood !== bushwick &&
    Math.random() < 0.5
  ) {
    [
      ridgewood,
      bushwick
    ] = [
      bushwick,
      ridgewood
    ];
  }

  return {
    Ridgewood: ridgewood,
    Bushwick: bushwick
  };
}

// -----------------------------------------
// GEOGRAPHIC SEPARATION
// -----------------------------------------

function blockNearbyPhotos(
  photo,
  blockedIds
) {
  if (
    !Array.isArray(photo.nearbyIds)
  ) {
    return;
  }

  for (
    const nearbyId
    of photo.nearbyIds
  ) {
    blockedIds.add(nearbyId);
  }
}

function photoIsAvailable(
  photo,
  {
    neighborhood,
    source,
    selectedIds,
    blockedIds,
    seenIds,
    allowSeen,
    ignoreNearby
  }
) {
  if (
    photo.neighborhood !== neighborhood
  ) {
    return false;
  }

  if (
    source &&
    photo.source !== source
  ) {
    return false;
  }

  if (
    selectedIds.has(photo.id)
  ) {
    return false;
  }

  if (
    !ignoreNearby &&
    blockedIds.has(photo.id)
  ) {
    return false;
  }

  if (
    !allowSeen &&
    seenIds.has(photo.id)
  ) {
    return false;
  }

  return true;
}

function candidatesFor(options) {
  return manifest.photos.filter(
    photo =>
      photoIsAvailable(
        photo,
        options
      )
  );
}

// -----------------------------------------
// PICK ONE PHOTO
// -----------------------------------------

function choosePhoto({
  neighborhood,
  selectedIds,
  blockedIds,
  seenIds
}) {
  const preferred =
    preferredSource();

  const alternate =
    otherSource(preferred);

  const attempts = [
    {
      source: preferred,
      allowSeen: false,
      ignoreNearby: false
    },
    {
      source: alternate,
      allowSeen: false,
      ignoreNearby: false
    },
    {
      source: null,
      allowSeen: false,
      ignoreNearby: false
    },
    {
      source: preferred,
      allowSeen: true,
      ignoreNearby: false
    },
    {
      source: alternate,
      allowSeen: true,
      ignoreNearby: false
    },
    {
      source: null,
      allowSeen: true,
      ignoreNearby: false
    },
    {
      source: null,
      allowSeen: false,
      ignoreNearby: true
    },
    {
      source: null,
      allowSeen: true,
      ignoreNearby: true
    }
  ];

  for (const attempt of attempts) {
    const candidates =
      candidatesFor({
        neighborhood,
        source:
          attempt.source,
        selectedIds,
        blockedIds,
        seenIds,
        allowSeen:
          attempt.allowSeen,
        ignoreNearby:
          attempt.ignoreNearby
      });

    if (candidates.length) {
      return randomItem(candidates);
    }
  }

  return null;
}

// -----------------------------------------
// BUILD 8-QUESTION ROUND
// -----------------------------------------

function buildQuestionSet() {
  const targets =
    chooseNeighborhoodTargets();

  const seenIds =
    getSeenIds();

  const selectedIds =
    new Set();

  const blockedIds =
    new Set();

  const selected = [];

  const neighborhoodSlots = [];

  for (
    let i = 0;
    i < targets.Ridgewood;
    i++
  ) {
    neighborhoodSlots.push(
      "Ridgewood"
    );
  }

  for (
    let i = 0;
    i < targets.Bushwick;
    i++
  ) {
    neighborhoodSlots.push(
      "Bushwick"
    );
  }

  const selectionOrder =
    shuffle(neighborhoodSlots);

  for (
    const neighborhood
    of selectionOrder
  ) {
    const photo =
      choosePhoto({
        neighborhood,
        selectedIds,
        blockedIds,
        seenIds
      });

    if (!photo) {
      throw new Error(
        "Could not build a complete round."
      );
    }

    selected.push(photo);

    selectedIds.add(photo.id);

    blockNearbyPhotos(
      photo,
      blockedIds
    );
  }

  return shuffle(selected).slice(
    0,
    QUESTION_COUNT
  );
}

// -----------------------------------------
// LIVE SCORE CIRCLES
// -----------------------------------------

function resetScoreTracker() {
  for (const dot of scoreDots) {
    dot.classList.remove(
      "correct",
      "wrong"
    );

    dot.textContent = "";
  }

  scoreTracker.setAttribute(
    "aria-label",
    "No questions answered yet"
  );
}

function updateScoreTracker(
  questionIndex,
  correct
) {
  const dot =
    scoreDots[questionIndex];

  if (!dot) {
    return;
  }

  dot.classList.remove(
    "correct",
    "wrong"
  );

  if (correct) {
    dot.classList.add("correct");
    dot.textContent = "✓";
  } else {
    dot.classList.add("wrong");
    dot.textContent = "X";
  }

  scoreTracker.setAttribute(
    "aria-label",
    `${score} correct after ${questionIndex + 1} questions`
  );
}

// -----------------------------------------
// LOAD GAME DATA
// -----------------------------------------

async function loadManifest() {
  const response =
    await fetch(
      "game_manifest.json",
      {
        cache: "no-cache"
      }
    );

  if (!response.ok) {
    throw new Error(
      `Could not load game data (${response.status})`
    );
  }

  const data =
    await response.json();

  if (
    !Array.isArray(data.photos) ||
    data.photos.length <
      QUESTION_COUNT
  ) {
    throw new Error(
      "Not enough photos in game manifest."
    );
  }

  manifest = data;
}

// -----------------------------------------
// RESET ROUND
// -----------------------------------------

function resetGameState() {
  currentIndex = 0;
  score = 0;
  answers = [];

  correctMessageIndex = 0;
  incorrectMessageIndex = 0;
  acceptingAnswer = false;

  resetScoreTracker();

  feedbackPanel.classList.add(
    "hidden"
  );

  answerArea.classList.remove(
    "hidden"
  );

  copyConfirmation.classList.add(
    "hidden"
  );
}

// -----------------------------------------
// IMAGE LOADING
// -----------------------------------------

function preloadQuestion(index) {
  const photo =
    questions[index];

  if (!photo) {
    return;
  }

  const image =
    new Image();

  image.src = photo.image;
}

function displayQuestion() {
  const photo =
    questions[currentIndex];

  if (!photo) {
    showResults();
    return;
  }

  acceptingAnswer = false;

  feedbackPanel.classList.add(
    "hidden"
  );

  answerArea.classList.remove(
    "hidden"
  );

  ridgewoodButton.disabled = true;
  bushwickButton.disabled = true;

  questionProgress.textContent =
    `${currentIndex + 1} / ${QUESTION_COUNT}`;

  photoSource.textContent =
    photo.source;

  gamePhoto.classList.remove(
    "loaded"
  );

  photoLoading.textContent =
    "Loading photo…";

  photoLoading.classList.remove(
    "hidden"
  );

  gamePhoto.onload = () => {
    photoLoading.classList.add(
      "hidden"
    );

    gamePhoto.classList.add(
      "loaded"
    );

    ridgewoodButton.disabled =
      false;

    bushwickButton.disabled =
      false;

    acceptingAnswer = true;

    announcer.textContent =
      `Question ${currentIndex + 1} of ${QUESTION_COUNT}.`;
  };

  gamePhoto.onerror = () => {
    acceptingAnswer = false;

    photoLoading.textContent =
      "Photo could not be loaded.";
  };

  gamePhoto.src =
    photo.image;

  preloadQuestion(
    currentIndex + 1
  );
}

// -----------------------------------------
// START ROUND
// -----------------------------------------

function startGame() {
  if (!manifest) {
    return;
  }

  try {
    resetGameState();

    questions =
      buildQuestionSet();

    // Reserve all eight immediately so a
    // refresh doesn't recreate the same round.
    markQuestionsSeen();

    showOnly(gameScreen);

    displayQuestion();

  } catch (error) {
    console.error(error);

    alert(
      "A new game could not be created. Please refresh and try again."
    );
  }
}

// -----------------------------------------
// ANSWER
// -----------------------------------------

function answerQuestion(guess) {
  if (!acceptingAnswer) {
    return;
  }

  acceptingAnswer = false;

  ridgewoodButton.disabled = true;
  bushwickButton.disabled = true;

  const photo =
    questions[currentIndex];

  const correct =
    guess === photo.neighborhood;

  if (correct) {
    score++;
  }

  answers.push({
    id: photo.id,
    guess,
    answer: photo.neighborhood,
    correct
  });

  updateScoreTracker(
    currentIndex,
    correct
  );

  answerArea.classList.add(
    "hidden"
  );

  feedbackPanel.classList.remove(
    "hidden",
    "feedback-correct",
    "feedback-wrong"
  );

  feedbackPanel.classList.add(
    correct
      ? "feedback-correct"
      : "feedback-wrong"
  );

  if (correct) {
    feedbackIcon.textContent =
      "✓";

    feedbackTitle.textContent =
      CORRECT_MESSAGES[
        Math.min(
          correctMessageIndex,
          CORRECT_MESSAGES.length - 1
        )
      ];

    correctMessageIndex++;

    feedbackText.textContent =
      `That's ${photo.neighborhood}.`;
  } else {
    feedbackIcon.textContent =
      "X";

    feedbackTitle.textContent =
      INCORRECT_MESSAGES[
        Math.min(
          incorrectMessageIndex,
          INCORRECT_MESSAGES.length - 1
        )
      ];

    incorrectMessageIndex++;

    feedbackText.textContent =
      `That photo was taken in ${photo.neighborhood}.`;
  }

  if (
    currentIndex ===
    QUESTION_COUNT - 1
  ) {
    setButtonText(nextButton, "SEE MY SCORE");
  } else {
    setButtonText(nextButton, "NEXT PHOTO");
  }
}

// -----------------------------------------
// NEXT
// -----------------------------------------

function nextQuestion() {
  if (
    currentIndex >=
    QUESTION_COUNT - 1
  ) {
    showResults();
    return;
  }

  currentIndex++;

  displayQuestion();
}

// -----------------------------------------
// FINAL SCORE CIRCLES
// -----------------------------------------

function renderFinalTracker() {
  finalScoreTracker.innerHTML = "";

  for (const answer of answers) {
    const dot =
      document.createElement(
        "span"
      );

    dot.className =
      "score-dot " +
      (
        answer.correct
          ? "correct"
          : "wrong"
      );

    dot.textContent =
      answer.correct
        ? "✓"
        : "X";

    finalScoreTracker.appendChild(
      dot
    );
  }
}

// -----------------------------------------
// RESULTS MESSAGES
// -----------------------------------------

function resultCopy() {
  const results = [
    {
      headline:
        "TRANSPLANT DETECTED",
      message:
        "You would probably get lost walking from Myrtle-Wyckoff to Myrtle-Wyckoff."
    },
    {
      headline:
        "NEW IN TOWN?",
      message:
        "Don’t worry. Your broker probably told you this was East East Williamsburg anyway."
    },
    {
      headline:
        "YOU SEEM CONFUSED.",
      message:
        "Try exploring more than just your local coffee shop."
    },
    {
      headline:
        "BORDERLINE LOCAL.",
      message:
        "You know just enough to correct someone and still be wrong."
    },
    {
      headline:
        "EH. 50% LOCAL.",
      message:
        "A coin could have done this well, but a coin can’t complain about the rent."
    },
    {
      headline:
        "RIDGEWOOD ADJACENT.",
      message:
        "You’re one rent increase away from becoming genuinely insufferable."
    },
    {
      headline:
        "DIVE BAR CARTOGRAPHER.",
      message:
        "You clearly know your way around. Now get a job."
    },
    {
      headline:
        "LOCAL SICKO.",
      message:
        "How many roommates did you have in 2017?"
    },
    {
      headline:
        "CERTIFIED NATIVE.",
      message:
        "Congratulations. You may now correct strangers about whether they’re technically in Ridgewood. Ridgewood Crave."
    }
  ];

  return results[
    Math.max(
      0,
      Math.min(
        score,
        results.length - 1
      )
    )
  ];
}


// -----------------------------------------
// SHOW RESULTS
// -----------------------------------------

function showResults() {
  acceptingAnswer = false;

  const copy =
    resultCopy();

  finalScore.textContent =
    String(score);

  resultHeadline.textContent =
    copy.headline;

  resultMessage.textContent =
    copy.message;

  renderFinalTracker();

  copyConfirmation.classList.add(
    "hidden"
  );

  setButtonText(shareButton, "SHARE SCORE");

  showOnly(resultsScreen);

  announcer.textContent =
    `Final score: ${score} out of ${QUESTION_COUNT}.`;
}

// -----------------------------------------
// SHARE SCORE
// -----------------------------------------

function resultSymbols() {
  return answers.map(
    answer =>
      answer.correct
        ? "🟢"
        : "🔴"
  );
}

function buildShareText() {
  const symbols =
    resultSymbols();

  const topRow =
    symbols
      .slice(0, 4)
      .join("");

  const bottomRow =
    symbols
      .slice(4, 8)
      .join("");

  const shareLabels = [
    "I’M A PATHETIC TRANSPLANT",
    "I’M NEW IN TOWN",
    "I AM CONFUSED",
    "I’M BORDERLINE LOCAL",
    "I’M 50% LOCAL",
    "I’M RIDGEWOOD ADJACENT",
    "DIVE BAR CARTOGRAPHER",
    "LOCAL SICKO",
    "CERTIFIED NATIVE"
  ];

  const shareLabel =
    shareLabels[
      Math.max(
        0,
        Math.min(
          score,
          shareLabels.length - 1
        )
      )
    ];

  return [
    `Transplant Tracker ${score}/${QUESTION_COUNT}`,
    shareLabel,
    topRow,
    bottomRow,
    "Think you can beat me?",
    GAME_URL
  ].join("\n");
}

async function copyTextToClipboard(text) {
  let copied = false;

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(
        text
      );

      copied = true;

    } catch {
      copied = false;
    }
  }

  /*
    Older-browser fallback.
  */

  if (!copied) {
    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value = text;

    textarea.setAttribute(
      "readonly",
      ""
    );

    textarea.style.position =
      "fixed";

    textarea.style.opacity =
      "0";

    document.body.appendChild(
      textarea
    );

    textarea.select();

    try {
      copied =
        document.execCommand(
          "copy"
        );
    } catch {
      copied = false;
    }

    textarea.remove();
  }

  return copied;
}


/* -----------------------------------------
   MOBILE / TOUCH DEVICE CHECK
----------------------------------------- */

function prefersNativeShare() {
  const touchDevice =
    navigator.maxTouchPoints > 0;

  const coarsePointer =
    window.matchMedia &&
    window.matchMedia(
      "(pointer: coarse)"
    ).matches;

  return (
    typeof navigator.share ===
      "function" &&
    (
      touchDevice ||
      coarsePointer
    )
  );
}


/* -----------------------------------------
   SHARE BUTTON
----------------------------------------- */

async function shareScore() {
  const text =
    buildShareText();

  /*
    Phones and tablets:
    open the operating system's native share menu.
  */

  if (prefersNativeShare()) {
    try {
      await navigator.share({
        title: GAME_NAME,
        text
      });

      return;

    } catch (error) {
      /*
        If the player simply closes the share
        sheet, do nothing.
      */

      if (
        error &&
        error.name ===
          "AbortError"
      ) {
        return;
      }

      /*
        If native sharing unexpectedly fails,
        fall through to clipboard copying.
      */

      console.warn(
        "Native sharing failed; using clipboard fallback.",
        error
      );
    }
  }


  /*
    Desktop:
    copy the exact formatted score.
  */

  const copied =
    await copyTextToClipboard(
      text
    );

  if (copied) {
    copyConfirmation.classList.remove(
      "hidden"
    );

    setButtonText(
      shareButton,
      "SCORE COPIED"
    );

    setTimeout(
      () => {
        setButtonText(
          shareButton,
          "SHARE SCORE"
        );
      },
      1800
    );

  } else {
    alert(
      "Your browser could not share or copy the score automatically."
    );
  }
}


// -----------------------------------------
// EVENTS
// -----------------------------------------

beginButton.addEventListener(
  "click",
  startGame
);

ridgewoodButton.addEventListener(
  "click",
  () =>
    answerQuestion(
      "Ridgewood"
    )
);

bushwickButton.addEventListener(
  "click",
  () =>
    answerQuestion(
      "Bushwick"
    )
);

nextButton.addEventListener(
  "click",
  nextQuestion
);

playAgainButton.addEventListener(
  "click",
  startGame
);

shareButton.addEventListener(
  "click",
  shareScore
);

// -----------------------------------------
// INITIALIZE
// -----------------------------------------

async function initialize() {
  beginButton.disabled = true;

  setButtonText(beginButton, "LOADING…");

  try {
    await loadManifest();

    beginButton.disabled = false;

    setButtonText(beginButton, "LET'S DO THIS THING");

  } catch (error) {
    console.error(error);

    setButtonText(beginButton, "GAME UNAVAILABLE");

    const note =
      document.querySelector(
        ".welcome-note"
      );

    if (note) {
      note.textContent =
        "The game data could not be loaded.";
    }
  }
}

initialize();
initialize();
