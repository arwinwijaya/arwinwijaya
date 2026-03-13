import fs from "node:fs/promises";
import { Chess } from "chess.js";

const user = process.env.LICHESS_USER || "marwinwijaya";
const token = process.env.CHESS_TOKEN || "";
const output = "metrics-chess.svg";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function chunkMoves(moves, size = 10) {
  const tokens = String(moves).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  for (let i = 0; i < tokens.length && lines.length < 3; i += size) {
    lines.push(tokens.slice(i, i + size).join(" "));
  }
  return lines;
}

function pieceGlyph(piece) {
  const map = {
    wp: "\u2659",
    wn: "\u2658",
    wb: "\u2657",
    wr: "\u2656",
    wq: "\u2655",
    wk: "\u2654",
    bp: "\u265F",
    bn: "\u265E",
    bb: "\u265D",
    br: "\u265C",
    bq: "\u265B",
    bk: "\u265A",
  };
  return map[`${piece.color}${piece.type}`] || "";
}

function boardStatesFromPgn(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const replay = new Chess();
  const moves = chess.history();
  const states = [replay.board()];
  for (const move of moves) {
    replay.move(move);
    states.push(replay.board());
  }
  return { moves, states };
}

function renderAnimatedBoard(states, moves) {
  const boardX = 34;
  const boardY = 78;
  const square = 42;
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const totalSteps = Math.min(states.length, 13);
  const visibleStates = states.slice(0, totalSteps);
  const duration = Math.max(visibleStates.length * 1.8, 6);

  let squares = "";
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const isLight = (rank + file) % 2 === 0;
      squares += `<rect x="${boardX + file * square}" y="${boardY + rank * square}" width="${square}" height="${square}" fill="${isLight ? "#f0d9b5" : "#b58863"}"/>`;
    }
  }

  let coords = "";
  for (let i = 0; i < 8; i++) {
    coords += `<text x="${boardX + i * square + 17}" y="${boardY + 355}" fill="#8b949e" font-size="12" font-family="'Segoe UI', Arial, sans-serif">${files[i]}</text>`;
    coords += `<text x="${boardX - 16}" y="${boardY + i * square + 25}" fill="#8b949e" font-size="12" font-family="'Segoe UI', Arial, sans-serif">${8 - i}</text>`;
  }

  const layers = visibleStates.map((state, stateIndex) => {
    let pieces = "";
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = state[rank][file];
        if (!piece) continue;
        pieces += `<text x="${boardX + file * square + 21}" y="${boardY + rank * square + 29}" text-anchor="middle" font-size="29" font-family="'Segoe UI Symbol','Noto Sans Symbols','Arial Unicode MS',sans-serif">${pieceGlyph(piece)}</text>`;
      }
    }
    const start = (stateIndex / visibleStates.length) * duration;
    const displayDuration = duration / visibleStates.length;
    const animationValues = stateIndex === visibleStates.length - 1 ? "0;1;1" : "0;1;0";
    return `<g opacity="${stateIndex === 0 ? "1" : "0"}">
  ${pieces}
  <animate attributeName="opacity" values="${animationValues}" keyTimes="0;0.08;1" dur="${displayDuration.toFixed(2)}s" begin="${start.toFixed(2)}s" fill="freeze"/>
</g>`;
  }).join("\n");

  const lastMoves = moves.slice(0, 12);
  const moveRows = [];
  for (let i = 0; i < lastMoves.length; i += 2) {
    const turn = Math.floor(i / 2) + 1;
    const white = lastMoves[i] || "";
    const black = lastMoves[i + 1] || "";
    moveRows.push(`${turn}. ${white} ${black}`.trim());
  }
  const movesText = moveRows.slice(0, 6).map((line, index) => {
    const y = 120 + index * 28;
    return `<text x="410" y="${y}" fill="#c9d1d9" font-size="18" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(line)}</text>`;
  }).join("\n  ");

  return {
    board: `
  <g>
    <rect x="${boardX - 10}" y="${boardY - 10}" width="356" height="356" rx="14" fill="#161b22" stroke="#30363d"/>
    ${squares}
    ${coords}
    ${layers}
  </g>`,
    moves: movesText,
  };
}

function renderCard({ title, subtitle, rows, footer, accent = "#1f6feb", boardSvg = "", movesSvg = "" }) {
  const safeRows = rows.map((row, index) => {
    const y = 390 + index * 24;
    return `<text x="32" y="${y}" fill="#c9d1d9" font-size="18" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(row)}</text>`;
  }).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="470" viewBox="0 0 800 470" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(title)}</title>
  <desc id="desc">${escapeHtml(subtitle)}</desc>
  <rect width="800" height="470" rx="20" fill="#0d1117"/>
  <rect x="1" y="1" width="798" height="468" rx="19" stroke="#30363d"/>
  <rect x="24" y="24" width="8" height="422" rx="4" fill="${accent}"/>
  <text x="52" y="62" fill="#f0f6fc" font-size="30" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(title)}</text>
  <text x="52" y="92" fill="#8b949e" font-size="18" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(subtitle)}</text>
  ${boardSvg}
  ${movesSvg}
  ${safeRows}
  <text x="32" y="438" fill="#8b949e" font-size="15" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(footer)}</text>
</svg>
`;
}

function resultText(game, userLogin) {
  const white = game.players?.white?.user?.name || "White";
  const black = game.players?.black?.user?.name || "Black";
  const winner = game.winner;
  const lower = userLogin.toLowerCase();
  const userColor = white.toLowerCase() === lower ? "white" : black.toLowerCase() === lower ? "black" : null;
  if (!userColor) return "Latest game found";
  if (!winner) return `Draw as ${userColor}`;
  return winner === userColor ? `Win as ${userColor}` : `Loss as ${userColor}`;
}

async function fetchLatestGame() {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=1&tags=true&clocks=false&evals=false&opening=true&pgnInJson=true`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/x-ndjson",
    },
  });

  if (!response.ok) {
    throw new Error(`Lichess API returned ${response.status}`);
  }

  const body = await response.text();
  const line = body.split("\n").find((entry) => entry.trim());
  if (!line) {
    throw new Error("No game data returned");
  }

  const game = JSON.parse(line);
  if (!game.pgn || typeof game.pgn !== "string") {
    throw new Error("PGN missing from Lichess response");
  }
  return game;
}

async function main() {
  try {
    const game = await fetchLatestGame();
    const white = game.players?.white?.user?.name || "White";
    const black = game.players?.black?.user?.name || "Black";
    const whiteElo = game.players?.white?.rating ? ` (${game.players.white.rating})` : "";
    const blackElo = game.players?.black?.rating ? ` (${game.players.black.rating})` : "";
    const opening = game.opening?.name || "Opening unavailable";
    const status = game.status || "unknown";
    const moveSummary = chunkMoves(game.moves || "");
    const { moves, states } = boardStatesFromPgn(game.pgn);
    const { board, moves: movesSvg } = renderAnimatedBoard(states, moves);

    const rows = [
      `${resultText(game, user)} | ${game.speed || "unknown"} | ${game.variant || "standard"}`,
      `${white}${whiteElo} vs ${black}${blackElo}`,
      `${opening}`,
      ...moveSummary.map((line, index) => index === 0 ? `Recent SAN: ${line}` : `            ${line}`),
    ].slice(0, 4);

    const svg = renderCard({
      title: "Last Chess Game",
      subtitle: `Lichess profile: ${user}`,
      rows,
      footer: `Status: ${status} | https://lichess.org/${game.id || ""}`,
      accent: "#2ea043",
      boardSvg: board,
      movesSvg,
    });
    await fs.writeFile(output, svg, "utf8");
  } catch (error) {
    const svg = renderCard({
      title: "Last Chess Game",
      subtitle: `Lichess profile: ${user}`,
      rows: [
        "Chess data is temporarily unavailable.",
        "The README remains stable even if the API or token fails.",
        "Check the Metrics (Chess) workflow logs for details.",
      ],
      footer: `Last update attempt failed: ${error.message}`,
      accent: "#d29922",
    });
    await fs.writeFile(output, svg, "utf8");
    process.exitCode = 0;
  }
}

await main();
