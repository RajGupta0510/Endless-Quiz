const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const cors    = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));   // allow image uploads up to 20 MB

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 25e6,   // 25 MB — enough for compressed images
});

// ── In-memory stores ───────────────────────────────────────────────────────────
const rooms  = {};

// Images stored as: imageStore["ROOMCODE_qi"] = { mimeType, data (base64) }
const imageStore = {};

// ── Image HTTP endpoint — all players fetch images via this URL ────────────────
// GET /img/:roomCode/:qi  → returns the image as binary
app.get("/img/:roomCode/:qi", (req, res) => {
  const key   = `${req.params.roomCode}_${req.params.qi}`;
  const entry = imageStore[key];
  if (!entry) return res.status(404).send("Image not found");
  const buf = Buffer.from(entry.data, "base64");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", entry.mimeType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(buf);
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getLeaderboard(room) {
  return Object.entries(room.players)
    .map(([id, p]) => ({
      id,
      name: p.name,
      score: p.score,
      avatarIndex: p.avatarIndex,
      totalAnswerTime: p.totalAnswerTime || 0
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.totalAnswerTime - b.totalAnswerTime;
    })
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function clearTimers(room) {
  if (room.questionTimer)  { clearInterval(room.questionTimer);  room.questionTimer  = null; }
  if (room.phaseTimeout)   { clearTimeout(room.phaseTimeout);    room.phaseTimeout   = null; }
  if (room.countdownTimer) { clearInterval(room.countdownTimer); room.countdownTimer = null; }
}

// ── Build the image URL for a question ────────────────────────────────────────
// Uses a relative path — the client prepends its own SERVER_URL so it works
// on localhost AND on local network (192.168.x.x) without hardcoding the IP.
function imageUrl(roomCode, qi) {
  const key = `${roomCode}_${qi}`;
  return imageStore[key] ? `/img/${roomCode}/${qi}` : null;
}

// ── Phase: reveal correct answer → leaderboard → auto-next ────────────────────
function endQuestion(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.state === "result") return;
  clearTimers(room);

  const question      = room.questions[room.currentQuestionIndex];
  const correctAnswer = question.correctAnswer;
  const isLast        = (room.currentQuestionIndex >= room.questions.length - 1) && (room.questions.length > 1);
  const qType         = question.qType || "mcq";
  const isCorrect     = (answer) => {
    if (!answer) return false;
    if (qType === "typed" || qType === "fillinblank") {
      // Case-insensitive, trimmed comparison
      return answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    }
    if (qType === "reorder") {
      // Answer is submitted as items joined by "|||" separator
      // Compare against the correct sequence (also joined)
      const correctSeq = (question.reorderItems || []).join("|||");
      return answer.trim() === correctSeq.trim();
    }
    return answer === correctAnswer;
  };

  // Score calculation
  const roundResults = {};
  const baseLimit = question.timeLimit + (isLast ? 3 : 0);
  Object.entries(room.players).forEach(([id, player]) => {
    let pointsEarned = 0;
    let elapsed = player.hasAnswered ? (player.elapsedMs || 0) : (baseLimit * 1000);

    // Accumulate total answer time
    player.totalAnswerTime = (player.totalAnswerTime || 0) + elapsed;

    if (player.hasAnswered && isCorrect(player.answer)) {
      const basePoints = isLast ? 2000 : 1000;
      const totalTimeLimitMs = baseLimit * 1000;
      const decayRatePerMs = basePoints / totalTimeLimitMs;

      pointsEarned = basePoints - (player.elapsedMs * decayRatePerMs);
      pointsEarned = Math.max(0, pointsEarned);
      pointsEarned = Math.round(pointsEarned * 10) / 10; // Round to 1 decimal place

      player.score += pointsEarned;
      player.score = Math.round(player.score * 10) / 10; // Avoid float inaccuracies
    }
    roundResults[id] = {
      name: player.name, answer: player.answer,
      correct: isCorrect(player.answer),
      pointsEarned, totalScore: player.score,
    };
  });

  room.state = "result";

  // Broadcast correct answer + correctOrder (for reorder type) to ALL players simultaneously
  io.to(roomCode).emit("question_result", {
    correctAnswer,
    results: roundResults,
    questionText: question.text,
    correctOrder: question.reorderItems || [],  // only used by reorder type, safe to send now
  });

  // After 3s: leaderboard
  room.phaseTimeout = setTimeout(() => {
    if (!rooms[roomCode]) return;
    room.state = "leaderboard";
    io.to(roomCode).emit("leaderboard_update", {
      leaderboard: getLeaderboard(room), isLast,
    });

    if (isLast) {
      // End quiz after 6s
      room.phaseTimeout = setTimeout(() => {
        if (!rooms[roomCode]) return;
        room.state = "finished";
        io.to(roomCode).emit("quiz_finished", { leaderboard: getLeaderboard(room) });
        // Clean up images for this room
        Object.keys(imageStore).forEach(k => {
          if (k.startsWith(roomCode + "_")) delete imageStore[k];
        });
      }, 6000);
    } else {
      // Auto-advance: countdown 5 → 1 → next question
      let countdown = 5;
      io.to(roomCode).emit("next_question_countdown", { countdown });
      room.countdownTimer = setInterval(() => {
        if (!rooms[roomCode]) return;
        countdown -= 1;
        if (countdown > 0) {
          io.to(roomCode).emit("next_question_countdown", { countdown });
        } else {
          clearInterval(room.countdownTimer);
          room.countdownTimer = null;
          room.currentQuestionIndex += 1;
          startQuestion(roomCode);
        }
      }, 1000);
    }
  }, 3000);
}

// ── Phase: broadcast question + start server timer ─────────────────────────────
function startQuestion(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  clearTimers(room);

  const qi       = room.currentQuestionIndex;
  const question = room.questions[qi];
  if (!question) return;
  const isLast   = (qi === room.questions.length - 1) && (room.questions.length > 1);
  const extraTime = isLast ? 3 : 0;

  Object.values(room.players).forEach(p => {
    p.hasAnswered = false; p.answer = null; p.timeLeft = null;
  });

  room.state         = "question";
  room.timeRemaining = question.timeLimit + extraTime;
  room.questionStartTime = Date.now();

  const qType   = question.qType || "mcq";

  // Build options per question type
  let options = [];
  if (qType === "mcq") {
    options = [...question.incorrectAnswers, question.correctAnswer]
      .sort(() => Math.random() - 0.5);
  } else if (qType === "reorder") {
    // Shuffle the correct sequence so player must reorder them
    options = [...question.reorderItems].sort(() => Math.random() - 0.5);
  }
  // "typed" and "fillinblank" send no options — player types freely

  // Build image URL — all players can fetch this directly
  const imgUrl = imageUrl(roomCode, qi);

  io.to(roomCode).emit("new_question", {
    questionIndex:  qi,
    totalQuestions: room.questions.length,
    text:           question.text,
    options,          // shuffled: MCQ options OR reorder items scrambled for player
    timeLimit:      question.timeLimit + extraTime,
    imageUrl:       imgUrl,
    qType,
    // NOTE: correctOrder is NOT sent here — it would reveal the answer.
    // It is sent after the timer in question_result.
  });

  room.questionTimer = setInterval(() => {
    if (!rooms[roomCode]) return;
    room.timeRemaining = Math.max(0, room.timeRemaining - 1);
    io.to(roomCode).emit("timer_update", { timeRemaining: room.timeRemaining });
    if (room.timeRemaining <= 0) endQuestion(roomCode);
  }, 1000);
}

// ── Socket events ──────────────────────────────────────────────────────────────
io.on("connection", socket => {
  console.log("+ connected:", socket.id);

  // HOST: create room
  socket.on("create_room", ({ hostName, questions, category, customCategory }) => {
    const roomCode = generateCode();
    rooms[roomCode] = {
      hostId: socket.id, hostName,
      players: {}, questions: questions || [],
      category: category || "Endless",
      customCategory: customCategory || "",
      currentQuestionIndex: 0, state: "lobby",
      timeRemaining: 0,
      questionTimer: null, phaseTimeout: null, countdownTimer: null,
    };
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.isHost   = true;
    socket.emit("room_created", { roomCode });
    console.log(`Room ${roomCode} created by ${hostName} (Category: ${category})`);
  });

  // HOST: upload image for a specific question
  // Called after create_room, before start_quiz
  // payload: { roomCode, questionIndex, mimeType, data (base64 string) }
  socket.on("upload_image", ({ roomCode, questionIndex, mimeType, data }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    if (!data || !mimeType) return;

    const key = `${roomCode}_${questionIndex}`;
    imageStore[key] = { mimeType, data };
    console.log(`Image stored: ${key} (${Math.round(data.length * .75 / 1024)} KB)`);

    // Acknowledge success back to host
    socket.emit("image_uploaded", { questionIndex, url: imageUrl(roomCode, questionIndex) });
  });

  // PLAYER: join room
  socket.on("join_room", ({ roomCode, playerName, avatarIndex }) => {
    const room = rooms[roomCode];
    if (!room) { socket.emit("error", { message: "Room not found. Check your code." }); return; }
    if (room.state !== "lobby") { socket.emit("error", { message: "Game already started." }); return; }

    // Assign a unique random avatar to the player
    const TOTAL_AVATARS = 12;
    const usedIndices = Object.values(room.players).map(p => p.avatarIndex);
    const freeIndices = [];
    for (let i = 0; i < TOTAL_AVATARS; i++) {
      if (!usedIndices.includes(i)) {
        freeIndices.push(i);
      }
    }
    let chosenIndex;
    if (freeIndices.length > 0) {
      chosenIndex = freeIndices[Math.floor(Math.random() * freeIndices.length)];
    } else {
      chosenIndex = Math.floor(Math.random() * TOTAL_AVATARS);
    }

    room.players[socket.id] = { name: playerName, score: 0, hasAnswered: false, answer: null, timeLeft: null, avatarIndex: chosenIndex, totalAnswerTime: 0 };
    socket.join(roomCode);
    socket.roomCode = roomCode;

    const playerList = Object.entries(room.players).map(([id, p]) => ({ id, name: p.name, score: p.score, avatarIndex: p.avatarIndex }));
    io.to(roomCode).emit("player_joined", { players: playerList, newPlayerName: playerName });
    socket.emit("join_success", {
      roomCode,
      playerName,
      category: room.category,
      customCategory: room.customCategory,
      avatarIndex: chosenIndex,
      themeImageUrl: imageStore[`${roomCode}_theme`] ? `/img/${roomCode}/theme` : null
    });
    console.log(`${playerName} joined ${roomCode} with avatar ${chosenIndex}`);
  });

  // HOST: start quiz
  socket.on("start_quiz", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    if (room.questions.length === 0) {
      socket.emit("error", { message: "Add at least one question first." }); return;
    }
    room.state = "playing";
    room.currentQuestionIndex = 0;
    Object.values(room.players).forEach(p => { p.score = 0; p.totalAnswerTime = 0; });
    io.to(roomCode).emit("quiz_started", { totalQuestions: room.questions.length });
    setTimeout(() => startQuestion(roomCode), 1500);
  });

  // PLAYER: submit answer
  socket.on("submit_answer", ({ roomCode, answer, elapsedMs }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player || player.hasAnswered || room.state !== "question") return;

    player.hasAnswered = true;
    player.answer      = answer;
    player.timeLeft    = room.timeRemaining;

    // Secure timing validation
    const serverElapsedMs = Date.now() - room.questionStartTime;
    let finalElapsedMs = typeof elapsedMs === "number" && elapsedMs >= 0 ? elapsedMs : serverElapsedMs;

    const minPossibleElapsed = serverElapsedMs - 300; // 300ms network buffer
    if (finalElapsedMs < minPossibleElapsed) {
      finalElapsedMs = serverElapsedMs;
    }
    player.elapsedMs = finalElapsedMs;

    socket.emit("answer_locked", { answer, timeLeft: room.timeRemaining });

    const allAnswered = Object.values(room.players).length > 0 &&
                        Object.values(room.players).every(p => p.hasAnswered);
    if (allAnswered) endQuestion(roomCode);
  });

  // PLAYER: update avatar
  socket.on("update_avatar", ({ roomCode, avatarIndex }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;
    player.avatarIndex = avatarIndex;
    const playerList = Object.entries(room.players).map(([id, p]) => ({ id, name: p.name, score: p.score, avatarIndex: p.avatarIndex }));
    io.to(roomCode).emit("player_joined", { players: playerList });
    console.log(`Player ${player.name} updated avatar to ${avatarIndex} in room ${roomCode}`);
  });

  // Disconnect
  socket.on("disconnect", () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];
    if (socket.isHost) {
      clearTimers(room);
      io.to(roomCode).emit("error", { message: "Host disconnected. Game ended." });
      // Clean up images
      Object.keys(imageStore).forEach(k => { if (k.startsWith(roomCode + "_")) delete imageStore[k]; });
      delete rooms[roomCode];
    } else {
      delete room.players[socket.id];
      const playerList = Object.entries(room.players).map(([id, p]) => ({ id, name: p.name, score: p.score, avatarIndex: p.avatarIndex }));
      io.to(roomCode).emit("player_joined", { players: playerList });
    }
    console.log(`- disconnected: ${socket.id} from ${roomCode}`);
  });
});

app.get("/health", (req, res) => res.json({ status: "ok", rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`EndPlays server on :${PORT}`));