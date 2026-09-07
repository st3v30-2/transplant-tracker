
// =========================================
// RIDGEWOOD OR BUSHWICK?
// GAME ENGINE
// =========================================

const QUESTION_COUNT = 8;

const SEEN_STORAGE_KEY =
  "ridgewood-or-bushwick-seen-v1";

// Replace this one value when the game
// has its real public URL.
const GAME_URL =
  "https://YOUR-GAME-URL-HERE.example";

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
      "Correct!";

    feedbackText.textContent =
      `That's ${photo.neighborhood}.`;
  } else {
    feedbackIcon.textContent =
      "X";

    feedbackTitle.textContent =
      "Not quite.";

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
  if (score === 8) {
    return {
      headline:
        "Perfect score.",
      message:
        "You know your Ridgewood from your Bushwick."
    };
  }

  if (score >= 6) {
    return {
      headline:
        "Neighborhood expert.",
      message:
        "You clearly know your way around the border."
    };
  }

  if (score >= 4) {
    return {
      headline:
        "Not bad.",
      message:
        "The Ridgewood–Bushwick border can be trickier than it looks."
    };
  }

  if (score >= 2) {
    return {
      headline:
        "The border got you.",
      message:
        "A few more walks around the neighborhood might help."
    };
  }

  return {
    headline:
      "Time for a neighborhood walk.",
    message:
      "Ridgewood and Bushwick had you guessing this time."
  };
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

  setButtonText(shareButton, "COPY SCORE TO SHARE");

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
        ? "🟩"
        : "🟥"
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

  return [
    `TransplantTracker ${score}/${QUESTION_COUNT}`,
    topRow,
    bottomRow,
    "Think you can beat me?",
    GAME_URL
  ].join("\n");
}

async function copyScore() {
  const text =
    buildShareText();

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

  if (copied) {
    copyConfirmation.classList.remove(
      "hidden"
    );

    setButtonText(shareButton, "SCORE COPIED");

    setTimeout(
      () => {
        setButtonText(shareButton, "COPY SCORE TO SHARE");
      },
      1800
    );

  } else {
    alert(
      "Your browser could not copy the score automatically."
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
  copyScore
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

    setButtonText(beginButton, "FINE.");

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
