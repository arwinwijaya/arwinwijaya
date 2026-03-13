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

function chunkMoves(moves, size = 8) {
  const tokens = String(moves).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  for (let i = 0; i < tokens.length && lines.length < 6; i += size) {
    lines.push(tokens.slice(i, i + size).join(" "));
  }
  return lines;
}

function pieceLabel(piece) {
  const map = {
    p: "P",
    n: "N",
    b: "B",
    r: "R",
    q: "Q",
    k: "K",
  };
  return map[piece.type] || "?";
}

function boardStatesFromPgn(pgn) {
  const parsed = new Chess();
  parsed.loadPgn(pgn);
  const replay = new Chess();
  const history = parsed.history();
  const states = [replay.board()];
  for (const move of history) {
    replay.move(move);
    states.push(replay.board());
  }
  return { history, states };
}

function renderBoard(states) {
  const boardX = 32;
  const boardY = 142;
  const square = 42;
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const frames = states.slice(0, 14);
  const frameDuration = 1.2;

  let squares = "";
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const isLight = (rank + file) % 2 === 0;
      const x = boardX + file * square;
      const y = boardY + rank * square;
      squares += `<rect x="${x}" y="${y}" width="${square}" height="${square}" fill="${isLight ? "#f0d9b5" : "#b58863"}"/>`;
    }
  }

  let labels = "";
  for (let i = 0; i < 8; i++) {
    labels += `<text x="${boardX + i * square + 16}" y="${boardY + 352}" fill="#8b949e" font-size="12" font-family="'Segoe UI', Arial, sans-serif">${files[i]}</text>`;
    labels += `<text x="${boardX - 16}" y="${boardY + i * square + 26}" fill="#8b949e" font-size="12" font-family="'Segoe UI', Arial, sans-serif">${8 - i}</text>`;
  }

  const layers = frames.map((state, index) => {
    let pieces = "";
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = state[rank][file];
        if (!piece) continue;
        const cx = boardX + file * square + 21;
        const cy = boardY + rank * square + 21;
        const fill = piece.color === "w" ? "#f8fafc" : "#0f172a";
        const stroke = piece.color === "w" ? "#94a3b8" : "#e2e8f0";
        const textFill = piece.color === "w" ? "#0f172a" : "#f8fafc";
        pieces += `<g>
  <circle cx="${cx}" cy="${cy}" r="15" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="${textFill}" font-size="16" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">${pieceLabel(piece)}</text>
</g>`;
      }
    }
    const begin = (index * frameDuration).toFixed(2);
    const dur = frameDuration.toFixed(2);
    const animationValues = index === frames.length - 1 ? "0;1;1" : "0;1;0";
    return `<g opacity="${index === 0 ? "1" : "0"}">
  ${pieces}
  <animate attributeName="opacity" values="${animationValues}" keyTimes="0;0.08;1" dur="${dur}s" begin="${begin}s" fill="freeze"/>
</g>`;
  }).join("\n");

  return `
  <g>
    <rect x="${boardX - 10}" y="${boardY - 10}" width="356" height="356" rx="14" fill="#161b22" stroke="#30363d"/>
    ${squares}
    ${labels}
    ${layers}
  </g>`;
}

function renderMoves(history) {
  const moveRows = [];
  for (let i = 0; i < history.length && moveRows.length < 6; i += 2) {
    const turn = Math.floor(i / 2) + 1;
    const white = history[i] || "";
    const black = history[i + 1] || "";
    moveRows.push(`${turn}. ${white} ${black}`.trim());
  }
  return moveRows.map((line, index) => {
    const y = 184 + index * 28;
    return `<text x="410" y="${y}" fill="#c9d1d9" font-size="18" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(line)}</text>`;
  }).join("\n  ");
}

function renderSvg({ subtitle, summary, opening, moveLines, history, states, footer, accent = "#2ea043" }) {
  const summaryText = [
    summary,
    opening,
    ...moveLines.slice(0, 3).map((line, index) => index === 0 ? `Recent SAN: ${line}` : `            ${line}`),
  ];
  const summarySvg = summaryText.map((line, index) => {
    const y = 474 + index * 18;
    return `<text x="32" y="${y}" fill="#c9d1d9" font-size="16" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(line)}</text>`;
  }).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="560" viewBox="0 0 800 560" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Last Chess Game</title>
  <desc id="desc">${escapeHtml(subtitle)}</desc>
  <rect width="800" height="560" rx="20" fill="#0d1117"/>
  <rect x="1" y="1" width="798" height="558" rx="19" stroke="#30363d"/>
  <rect x="24" y="24" width="8" height="512" rx="4" fill="${accent}"/>
  <text x="52" y="62" fill="#f0f6fc" font-size="30" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">Last Chess Game</text>
  <text x="52" y="92" fill="#8b949e" font-size="18" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(subtitle)}</text>
  ${renderBoard(states)}
  ${renderMoves(history)}
  ${summarySvg}
  <text x="32" y="546" fill="#8b949e" font-size="14" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(footer)}</text>
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

function renderFallback(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="240" viewBox="0 0 800 240" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Last Chess Game</title>
  <desc id="desc">Chess data unavailable</desc>
  <rect width="800" height="240" rx="20" fill="#0d1117"/>
  <rect x="1" y="1" width="798" height="238" rx="19" stroke="#30363d"/>
  <rect x="24" y="24" width="8" height="192" rx="4" fill="#d29922"/>
  <text x="52" y="62" fill="#f0f6fc" font-size="30" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">Last Chess Game</text>
  <text x="52" y="100" fill="#c9d1d9" font-size="18" font-family="'Segoe UI', Arial, sans-serif">Chess data is temporarily unavailable.</text>
  <text x="52" y="132" fill="#c9d1d9" font-size="18" font-family="'Segoe UI', Arial, sans-serif">The README remains stable even if the API or token fails.</text>
  <text x="52" y="164" fill="#c9d1d9" font-size="18" font-family="'Segoe UI', Arial, sans-serif">Check the Metrics (Chess) workflow logs for details.</text>
  <text x="52" y="204" fill="#8b949e" font-size="15" font-family="'Segoe UI', Arial, sans-serif">${escapeHtml(message)}</text>
</svg>
`;
}

async function main() {
  try {
    const game = await fetchLatestGame();
    const white = game.players?.white?.user?.name || "White";
    const black = game.players?.black?.user?.name || "Black";
    const whiteElo = game.players?.white?.rating ? ` (${game.players.white.rating})` : "";
    const blackElo = game.players?.black?.rating ? ` (${game.players.black.rating})` : "";
    const opening = game.opening?.name || "Opening unavailable";
    const { history, states } = boardStatesFromPgn(game.pgn);
    const moveLines = chunkMoves(game.moves || "");
    const summary = `${resultText(game, user)} | ${game.speed || "unknown"} | ${game.variant || "standard"} | ${white}${whiteElo} vs ${black}${blackElo}`;
    const footer = `Status: ${game.status || "unknown"} | https://lichess.org/${game.id || ""}`;

    const svg = renderSvg({
      subtitle: `Lichess profile: ${user}`,
      summary,
      opening,
      moveLines,
      history,
      states,
      footer,
    });
    await fs.writeFile(output, svg, "utf8");
  } catch (error) {
    await fs.writeFile(output, renderFallback(`Last update attempt failed: ${error.message}`), "utf8");
    process.exitCode = 0;
  }
}

await main();
