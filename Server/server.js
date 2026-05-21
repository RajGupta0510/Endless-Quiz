const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── In-memory store ──────────────────────────────────────────────────────────
const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getLeaderboard(room) {
  return Object.entries(room.players)
    .map(([id, p]) => ({ id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function clearRoomTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function endQuestion(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  clearRoomTimer(room);

  const question = room.questions[room.currentQuestionIndex];
  const correctAnswer = question.correctAnswer;

  // Calculate scores for this round
  const roundResults = {};
  Object.entries(room.players).forEach(([id, player]) => {
    let pointsEarned = 0;
    if (player.hasAnswered && player.answer === correctAnswer) {
      const basePoints = 1000;
      const totalTime = question.timeLimit;
      pointsEarned = Math.round(basePoints * (player.timeLeft / totalTime));
      player.score += pointsEarned;
    }
    roundResults[id] = {
      name: player.name,
      answer: player.answer,
      correct: player.answer === correctAnswer,
      pointsEarned,
      totalScore: player.score,
    };
  });

  room.state = "result";

  io.to(roomCode).emit("question_result", {
    correctAnswer,
    results: roundResults,
    questionText: question.text,
  });

  // After 3s show leaderboard
  setTimeout(() => {
    if (!rooms[roomCode]) return;
    const lb = getLeaderboard(room);
    room.state = "leaderboard";
    io.to(roomCode).emit("leaderboard_update", {
      leaderboard: lb,
      isLast: room.currentQuestionIndex >= room.questions.length - 1,
    });
  }, 3000);
}

function startQuestion(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const question = room.questions[room.currentQuestionIndex];
  const totalTime = question.timeLimit;

  // Reset per-question player state
  Object.values(room.players).forEach((p) => {
    p.hasAnswered = false;
    p.answer = null;
    p.timeLeft = null;
  });

  room.state = "question";
  room.timeRemaining = totalTime;

  // Shuffle options before sending
  const options = [...question.incorrectAnswers, question.correctAnswer].sort(
    () => Math.random() - 0.5
  );

  io.to(roomCode).emit("new_question", {
    questionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    text: question.text,
    options,
    timeLimit: totalTime,
    // Never send image data over socket — only flag and index
    hasImage: !!question.hasImage,
    imageIndex: question.imageIndex ?? room.currentQuestionIndex,
  });

  // Server-controlled timer
  room.timerInterval = setInterval(() => {
    if (!rooms[roomCode]) return;
    room.timeRemaining -= 1;
    io.to(roomCode).emit("timer_update", { timeRemaining: room.timeRemaining });

    if (room.timeRemaining <= 0) {
      endQuestion(roomCode);
    }
  }, 1000);
}

// ── Socket events ────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // HOST: Create room
  socket.on("create_room", ({ hostName, questions }) => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      hostId: socket.id,
      hostName,
      players: {},
      questions: questions || [],
      currentQuestionIndex: 0,
      state: "lobby",
      timerInterval: null,
      timeRemaining: 0,
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.isHost = true;

    socket.emit("room_created", {
      roomCode,
      inviteLink: `${roomCode}`,
    });

    console.log(`Room ${roomCode} created by ${hostName}`);
  });

  // PLAYER: Join room
  socket.on("join_room", ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }
    if (room.state !== "lobby") {
      socket.emit("error", { message: "Game already in progress" });
      return;
    }

    room.players[socket.id] = {
      name: playerName,
      score: 0,
      hasAnswered: false,
      answer: null,
      timeLeft: null,
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;

    // Notify all in room
    io.to(roomCode).emit("player_joined", {
      players: Object.entries(room.players).map(([id, p]) => ({
        id,
        name: p.name,
        score: p.score,
      })),
    });

    socket.emit("join_success", { roomCode, playerName });
    console.log(`${playerName} joined room ${roomCode}`);
  });

  // HOST: Start quiz
  socket.on("start_quiz", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit("error", { message: "Only host can start" });
      return;
    }
    if (room.questions.length === 0) {
      socket.emit("error", { message: "No questions added" });
      return;
    }

    room.state = "playing";
    room.currentQuestionIndex = 0;

    // Reset all scores
    Object.values(room.players).forEach((p) => {
      p.score = 0;
    });

    io.to(roomCode).emit("quiz_started", {
      totalQuestions: room.questions.length,
    });

    setTimeout(() => startQuestion(roomCode), 1500);
  });

  // PLAYER: Submit answer (CRITICAL - enforce one-answer rule on server)
  socket.on("submit_answer", ({ roomCode, answer }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players[socket.id];
    if (!player) return; // not a player

    // ENFORCE: one answer per question
    if (player.hasAnswered) {
      socket.emit("error", { message: "You already answered this question" });
      return;
    }

    if (room.state !== "question") {
      socket.emit("error", { message: "Question is not active" });
      return;
    }

    // Lock the answer
    player.hasAnswered = true;
    player.answer = answer;
    player.timeLeft = room.timeRemaining;

    socket.emit("answer_locked", {
      answer,
      timeLeft: room.timeRemaining,
    });

    // Check if all players answered
    const allAnswered = Object.values(room.players).every((p) => p.hasAnswered);
    if (allAnswered && Object.keys(room.players).length > 0) {
      endQuestion(roomCode);
    }
  });

  // HOST: Next question
  socket.on("next_question", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return;

    room.currentQuestionIndex += 1;

    if (room.currentQuestionIndex >= room.questions.length) {
      room.state = "finished";
      const lb = getLeaderboard(room);
      io.to(roomCode).emit("quiz_finished", { leaderboard: lb });
    } else {
      startQuestion(roomCode);
    }
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    const roomCode = socket.roomCode;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];

    if (socket.isHost) {
      // Host left — end the game
      clearRoomTimer(room);
      io.to(roomCode).emit("error", { message: "Host disconnected. Game ended." });
      delete rooms[roomCode];
    } else {
      delete room.players[socket.id];
      io.to(roomCode).emit("player_joined", {
        players: Object.entries(room.players).map(([id, p]) => ({
          id,
          name: p.name,
          score: p.score,
        })),
      });
    }

    console.log(`Socket ${socket.id} disconnected from room ${roomCode}`);
  });
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`EndPlays server running on port ${PORT}`);
});
