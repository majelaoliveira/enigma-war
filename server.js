const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { networkInterfaces } = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =====================================================
// ARQUIVOS ESTÁTICOS
// =====================================================

app.use(express.static(path.join(__dirname)));

// =====================================================
// ESTADO GLOBAL
// =====================================================

let gameState = {
  round: 0,
  active: false,
  anagram: '',
  category: '',
  timer: 90,
  g1Answered: false,
  g2Answered: false,
  g1Correct: null,
  g2Correct: null,
  attackCity1: null,
  attackCity2: null,
};

// =====================================================
// SOCKET.IO
// =====================================================

io.on('connection', (socket) => {

  console.log(`[+] Conectado: ${socket.id}`);

  socket.emit('state', gameState);

  // ---------------------------------------------------
  // NOVA RODADA
  // ---------------------------------------------------

  socket.on('round:start', (data) => {

    gameState = {
      round: data.round,
      active: true,
      anagram: data.anagram,
      category: data.category,
      timer: 90,
      g1Answered: false,
      g2Answered: false,
      g1Correct: null,
      g2Correct: null,
      attackCity1: data.attackCity1,
      attackCity2: data.attackCity2,
    };

    console.log(
      `[RODADA ${data.round}] Anagrama: ${data.anagram}`
    );

    io.emit('round:start', gameState);
  });

  // ---------------------------------------------------
  // FIM DA RODADA
  // ---------------------------------------------------

  socket.on('round:end', (data) => {

    gameState.active = false;
    gameState.g1Correct = data.g1Correct;
    gameState.g2Correct = data.g2Correct;

    io.emit('round:end', data);
  });

  // ---------------------------------------------------
  // TIMER
  // ---------------------------------------------------

  socket.on('timer:tick', (secs) => {

    gameState.timer = secs;

    io.emit('timer:tick', secs);
  });

  // ---------------------------------------------------
  // RESET
  // ---------------------------------------------------

  socket.on('game:reset', () => {

    gameState = {
      round: 0,
      active: false,
      anagram: '',
      category: '',
      timer: 90,
      g1Answered: false,
      g2Answered: false,
      g1Correct: null,
      g2Correct: null,
      attackCity1: null,
      attackCity2: null,
    };

    io.emit('game:reset');

    console.log('[RESET] Jogo reiniciado');
  });

  // ---------------------------------------------------
  // RESPOSTAS
  // ---------------------------------------------------

  socket.on('answer:submit', (data) => {

    console.log(
      `[GRUPO ${data.group}] Rodada ${data.round} -> "${data.answer}"`
    );

    if (data.group === 1)
      gameState.g1Answered = true;

    if (data.group === 2)
      gameState.g2Answered = true;

    io.emit('answer:received', data);
  });

  // ---------------------------------------------------
  // ÁUDIO
  // ---------------------------------------------------

  socket.on('audio:play', (data) => {

    console.log(`[AUDIO] ${data.tipo}`);

    io.emit('audio:play', data);
  });

  // ---------------------------------------------------
  // DESCONECTAR
  // ---------------------------------------------------

  socket.on('disconnect', () => {

    console.log(`[-] Desconectado: ${socket.id}`);
  });
});

// =====================================================
// START
// =====================================================

const PORT = 3000;

server.listen(PORT, '0.0.0.0', () => {

  const nets = networkInterfaces();

  let localIP = 'localhost';

  for (const name of Object.keys(nets)) {

    if (
      name.includes('docker') ||
      name.includes('br-') ||
      name.includes('vboxnet')
    ) {
      continue;
    }

    for (const net of nets[name]) {

      if (
        net.family === 'IPv4' &&
        !net.internal
      ) {
        localIP = net.address;

        if (name.startsWith('wl'))
          break;
      }
    }
  }

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         ENIGMA WAR — SERVIDOR ATIVO      ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Projetor  : http://${localIP}:${PORT}/servidor.html`);
  console.log(`║  Grupo 1   : http://${localIP}:${PORT}/terminal.html?grupo=1`);
  console.log(`║  Grupo 2   : http://${localIP}:${PORT}/terminal.html?grupo=2`);
  console.log('╚══════════════════════════════════════════╝\n');
});

// =====================================================
// ENCERRAMENTO LIMPO
// =====================================================

let encerrando = false;

function encerrarServidor(origem) {

  if (encerrando) return;

  encerrando = true;

  console.log(
    `\n[${origem}] Encerrando servidor...`
  );

  io.emit('game:reset');

  server.close(() => {

    console.log(
      'Porta 3000 liberada com sucesso.'
    );

    process.exit(0);
  });

  setTimeout(() => {

    console.log(
      'Forçando encerramento...'
    );

    process.exit(1);

  }, 3000);
}

process.on(
  'SIGINT',
  () => encerrarServidor('SIGINT')
);

process.on(
  'SIGTERM',
  () => encerrarServidor('SIGTERM')
);

process.on(
  'uncaughtException',
  (err) => {

    console.error(
      '\nERRO NÃO TRATADO:\n',
      err
    );

    encerrarServidor('ERRO');
  }
);