// @flow

const fs = require('fs');
const Telnet = require('telnet-client');
const trash = require('trash');
const childProcess = require('child_process');

const trashedFiles = {};
const skippedFiles = {};

const CLEAN_CWD = '/Users/mark/Downloads/Videos/';
const CLEAN_SH = '/Users/mark/Downloads/Videos/clean.sh';
const PATHS_TO_TRASH = /\/Downloads\/(Torrents|Videos)\//;

const INTROS = [
  {
    fileRx: /\/Bleach .*/i,
    length: 90,
  },
];

function connect() {
  return new Promise((resolve, reject) => {
    const params = {
      host: '127.0.0.1',
      port: 4212,
      shellPrompt: '> ',
      timeout: 500,
      execTimeout: 500,
      sendTimeout: 500,
      password: 'password',
      passwordPrompt: /Password:.*/,
      debug: true,
      echoLines: 0,
      ors: '\r\n',
    };

    const connection = new Telnet();

    connection
      .on('error', reject)
      .connect(params)
      .catch(reject)
      .then(() => resolve(connection));
  });
}

async function monitor(connection) {
  console.log('connection opened');

  const intervals = [];

  connection.oldExec = connection.exec;
  connection.exec = async cmd => {
    const response = await connection.oldExec(cmd);
    return response.trim();
  };

  async function pollStatus() {
    const time = +await connection.exec('get_time');
    const length = +await connection.exec('get_length');

    if (time < 10) {
      skipIntro();
    } else if (time >= length * 0.9) {
      trashCurrentFile();
    }
  }

  async function genFileName() {
    const status = await connection.exec('status');
    const fileName = /input: file:\/\/(\/.*?) \)/.exec(status)[1];

    return fileName;
  }

  async function skipIntro() {
    const fileName = await genFileName();

    INTROS.forEach(intro => {
      if (skippedFiles[fileName]) return;
      if (intro.fileRx.test(fileName)) {
        const timeToSkip = intro.length;

        connection.exec(`seek ${timeToSkip}`);

        skippedFiles[fileName] = 1;
      }
    });
  }

  async function trashCurrentFile() {
    const fileName = await genFileName();

    if (!PATHS_TO_TRASH.test(fileName) || trashedFiles[fileName]) return;

    trash(fileName);
    trashedFiles[fileName] = 1;

    childProcess.exec(CLEAN_SH, { cwd: CLEAN_CWD }, () => {});
  }

  intervals.push(setInterval(pollStatus, 1000));

  connection.on('close', () => {
    console.log('connection closed');
    pollForConnection();
    intervals.forEach(i => clearInterval(i));
  });
}

function pollForConnection() {
  connect()
    .then(connection => {
      monitor(connection);
    })
    .catch(() => setTimeout(pollForConnection, 5000));
}

pollForConnection();
