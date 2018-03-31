const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const Telnet = require('telnet-client');
const trash = require('trash');
const notifier = require('node-notifier');

const CLEAN_CWD = '/Users/mark/Downloads/Videos/';
const CLEAN_SH = '/Users/mark/Downloads/Videos/clean.sh';
const PATHS_TO_TRASH = /\/Downloads\/(Torrents|Videos)\//;

const INTROS = [
  {
    fileRx: /\/Bleach .*/i,
    length: 90,
  },
];

const POLL_INTERVAL = 1500;
const SKIP_INTRO_MAX_TIME = 10;
const PLAY_COMPLETE_PERCENT = 0.9;
const CONNECTION_PARAMS = {
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

class ConnectionMonitor {
  constructor(connection) {
    console.log('connection opened');
    this.trashedFiles = {};
    this.skippedFiles = {};
    this.fileToTrash = '';
    this.connection = connection;
    this.pollInterval = setInterval(() => this.pollStatus(), POLL_INTERVAL);
    this.playing = false;
    this.lastTime = 0;
    this.lastFileName = '';

    connection.on('close', () => {
      console.log('connection closed');
      this.stopped();
      clearInterval(this.pollInterval);
      pollForConnection();
    });
  }

  async exec(cmd) {
    const response = await this.connection.exec(cmd);
    return response.trim();
  }

  async pollStatus() {
    const time = +await this.exec('get_time');
    const length = +await this.exec('get_length');
    const fileName = await this.genFileName();
    this.trackTime(fileName, time);

    if (time < SKIP_INTRO_MAX_TIME) {
      this.skipIntro();
    } else if (time >= length * PLAY_COMPLETE_PERCENT) {
      this.trashCurrentFile();
    }
  }

  trackTime(fileName, time) {
    const playing = time !== this.lastTime;
    if (this.lastFileName) {
      if (fileName !== this.lastFileName || !playing) {
        this.stopped();
      }
    }

    this.lastFileName = fileName;
    this.lastTime = time;
    if (playing !== this.playing) {
      this.playing = playing;
    }
  }

  async genFileName() {
    const status = await this.exec('status');
    const fileName = (/input: file:\/\/(\/.*?) \)/.exec(status) || ['', ''])[1];

    return fileName;
  }

  async skipIntro() {
    const fileName = await this.genFileName();

    INTROS.forEach(intro => {
      if (this.skippedFiles[fileName]) return;

      if (intro.fileRx.test(fileName)) {
        const timeToSkip = intro.length;
        this.exec(`seek ${timeToSkip}`);
        this.skippedFiles[fileName] = 1;
      }
    });
  }

  async stopped() {
    const fileName = this.fileToTrash;
    if (!fileName) return;

    trash(fileName);
    console.log(`trash ${fileName}`);

    const fileParsed = path.parse(fileName);
    childProcess.exec(CLEAN_SH, { cwd: CLEAN_CWD }, () => {});

    // Showing 2 notifications makes the first one persist no matter what, so commenting out for now
    // notifier.notify({
    //   title: 'Video Complete',
    //   message: `Deleted ${fileParsed.base}`,
    //   timeout: 2,
    // });
    setTimeout(() => this.promptNextFile(fileParsed), 1000);

    this.fileToTrash = '';
  }

  async promptNextFile(fileParsed) {
    const files = fs.readdirSync(fileParsed.dir);
    files.sort((a, b) => a > b);

    const nextFile = files[files.indexOf(fileParsed.base) + 1];
    const isSameSeries = this.isSameSeries(fileParsed.base, nextFile);

    if (!isSameSeries) return;
    const playlist = await this.exec('playlist');
    const nextIsInPlaylist = playlist.indexOf(nextFile) >= 0;

    if (nextIsInPlaylist) return;

    notifier.notify(
      {
        title: 'Play Next Episode?',
        message: `Play ${nextFile}?`,
        closeLabel: 'No',
        actions: 'Play',
        timeout: 30,
      },
      (err, response, metadata) => {
        if (response === 'activate' && metadata.activationValue === 'Play') {
          const nextFilePath = path.join(fileParsed.dir, nextFile);
          this.exec(`add ${nextFilePath}`);
        }
      },
    );
  }

  isSameSeries(fileA, fileB) {
    if (!fileA || !fileB) return false;

    return /^[^\d]+/.exec(fileA)[0] === /^[^\d]+/.exec(fileB)[0];
  }

  async trashCurrentFile() {
    const fileName = await this.genFileName();

    if (!PATHS_TO_TRASH.test(fileName) || this.trashedFiles[fileName]) return;

    this.fileToTrash = fileName;
    this.trashedFiles[fileName] = 1;
  }
}

function connect() {
  return new Promise((resolve, reject) => {
    const connection = new Telnet();

    connection
      .on('error', reject)
      .connect(CONNECTION_PARAMS)
      .then(() => resolve(connection))
      .catch(reject);
  });
}

function pollForConnection() {
  connect()
    .then(connection => {
      new ConnectionMonitor(connection);
    })
    .catch(() => setTimeout(pollForConnection, 5000));
}

pollForConnection();
