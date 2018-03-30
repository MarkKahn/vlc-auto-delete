// @flow

const fs = require('fs');
const Telnet = require('telnet-client');
const trash = require('trash');
const childProcess = require('child_process');

const trashedFiles = {};

const CLEAN_CWD = '/Users/mark/Downloads/Videos/';
const CLEAN_SH = '/Users/mark/Downloads/Videos/clean.sh';

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

    if (time >= length * 0.95) {
      trashCurrentFile();
    }
  }

  async function trashCurrentFile() {
    const status = await connection.exec('status');
    const file = /input: file:\/\/(\/.*?) \)/.exec(status)[1];

    if (trashedFiles[file]) return;

    trash(file);
    trashedFiles[file] = 1;

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
