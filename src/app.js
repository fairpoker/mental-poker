const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const lessMiddleware = require('less-middleware');
const path = require('path');
const bodyParser = require('body-parser');
const errorHandler = require('errorhandler');
const cookieParser = require('cookie-parser');
const validator = require('express-validator/check');
const logger = require('./logger');
const {
  redisGameSub,
} = require('./redis');
const {
  cancelActionTimers,
  setActionTimers,
} = require('./timers');
const {
  clearTablesHandler,
  newTableHandler,
  deleteAllTablesHandler,
  deleteTableHandler,
  newTableValidator,
} = require('./handlers/admin');
const {
  getLobbyDataHandler,
  getTableDataHandler,
} = require('./handlers/public');
const {
  webSocketAPIHandler,
  connLeftTable,
  connected,
  executeTableFunction,
} = require('./handlers/webSocket');
const {
  mainURL,
} = require('./utils/consts');

// Log promise rejections
process.on('unhandledRejection', reason => logger.error(`Unhandled Rejection. ${reason.stack}`));

// Environment variables
const port = process.env.PORT || 3000;

// Server variables
const app = express(); // The main application
const server = http.createServer(app);
const io = socketio.listen(server);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// Disabling the caching of files helps avoid clients running old versions of the front end app
// app.use(nocache());

app.use(lessMiddleware(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

server.listen(port, () => logger.info(`Listening on port ${port}`));

// Development Only
if (app.get('env') === 'development') {
  app.use(errorHandler());
}

// The lobby
app.get('/', (req, res) => {
  res.render('index');
});

// Redirect to the auth URL
app.get('/auth', (req, res) => {
  res.redirect(`${mainURL}/me/account?action=play`);
});

/**
 * It returns all public poker tables.
 * @return {Array} - The list of tables
 */
app.get('/lobby-data', getLobbyDataHandler);

// If the table is requested manually, redirect to lobby
app.get('/table-9/:tableID', (req, res) => {
  res.redirect('/');
});

// If the table is requested manually, redirect to lobby
app.get('/table-6/:tableID', (req, res) => {
  res.redirect('/');
});

// If the table is requested manually, redirect to lobby
app.get('/table-2/:tableID', (req, res) => {
  res.redirect('/');
});

// The table data
app.get('/table-data/:tableID', getTableDataHandler);

/*
 * Admin API for adding a table to redis.
 */
const tableAdmin = express(); // API for adding tables
tableAdmin.use(bodyParser.json());

tableAdmin.post('/new-table', newTableValidator, newTableHandler);

tableAdmin.post('/clear-tables', clearTablesHandler);

tableAdmin.delete('/all-tables', deleteAllTablesHandler);

tableAdmin.post('/delete-table', [
  validator.check('tableID').isString(),
], deleteTableHandler);

tableAdmin.listen(8080, () => logger.info(`Admin listening on ${8080}`));

/* Listen for events from redis:
 * List of events we are listening here:
 *  - table-socket: Sends the message to the client if the client is connected to this container
 *  - table-events: Sends table events to clients connected to this container
 *  - kick-player: Updates data about the players connected to this container.
 *       -> It is used when a player is kicked out of the table, or has timed out
 *  - table-actions: It performs actions on the table like endRound or nextPhase.
 *       -> It is used on showdown when we want to wait some time before beginning next phase
 *       -> Also, when all players are all-in and we wait 1-2s before calling next phase
 *  - cancel-timers: Cancels the timers for th table ID
 */
redisGameSub.on('message', (chan, msg) => {
  const data = JSON.parse(msg);
  const [event, tableID] = chan.split(':');
  switch (event) {
    case 'table-socket': // If the socket is connected to this container, send the message
      if (connected[data.socketID]) {
        // If the receiver of the message is connected here, send the message.
        const { socket } = connected[data.socketID];
        socket.emit(...data.args);
      }
      break;

    case 'table-events': // Send the table event to sockets connected to this container playing on the given table
      io.sockets
        .in(`table-${data.tableID}`)
        .emit(data.eventName, data.eventData);
      break;

    case 'kick-player': // When a player is kicked from a table and we need to update our socket
      if (connected[data.socketID]) {
        logger.debug(`kicking player ${data.username}`);
        connLeftTable(data.socketID);
      }
      break;

    case 'table-actions': // Perform an action on the table
      executeTableFunction(tableID, data.action, data.round, data.do);
      break;

    case 'cancel-timers': // Cancel timers for table
      cancelActionTimers(tableID, data.action, data.round);
      break;

    case 'set-timers':
      logger.silly(`setting action timers on tableID ${tableID}`);
      setActionTimers(tableID, data.action, data.round, data.duration);
      break;

    // no default
  }
});
redisGameSub.subscribe('new-table');

io.sockets.on('connection', webSocketAPIHandler);
