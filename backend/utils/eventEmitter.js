const EventEmitter = require('events');
class AppEmitter extends EventEmitter {}
const appEmitter = new AppEmitter();
// One SSE listener is registered per open thread view (removed on close).
// Defaults of 10 would warn on a busy day without any leak; raising it keeps
// the noise down while 'close' still cleans every listener up.
appEmitter.setMaxListeners(0);
module.exports = appEmitter;
