
var QueryController = require('./slot-notifier.controler');

module.exports = function(router) {
    router.get('/start-watching', QueryController.startWatching);
}