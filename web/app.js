
/**
 * Module dependencies.
 */

var fs = require('fs');
var waiconst = require('./waiconst');
var accessLog = fs.createWriteStream(waiconst.LOG_PATH + 'access.log', {flags: 'a'});
var errorLog = fs.createWriteStream(waiconst.LOG_PATH + 'error.log', {flags: 'a'});

var express = require('express')
  , routes = require('./routes');
var app = module.exports = express.createServer();
var io = require('socket.io').listen(app);
var db = require('./models/db');
var ObjectId = require('mongoose').Types.ObjectId;
// Configuration

app.configure(function(){
  app.use(express.logger({stream: accessLog}));
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: "robaroba" }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
  app.error(function(err, req, res, next) {
    var s = '[' + new Date() + ']' + req.url + '\n';
    errorLog.write(s + err.stack + '\n');
    next();
  });
});

app.dynamicHelpers({
  error: function(req, res) {
    var err = req.flash('error');
    if (err.length) return err;
    return null;
  },
  success: function(req, res) {
    var suc = req.flash('success');
    if (suc.length) return suc;
    return null;
  },
  user: function(req, res) {
    if (req.session.user != null)
      return req.session.user.nick;
    return null;
  },
  user_id: function(req, res) {
    if (req.session.user != null)
      return req.session.user._id;
    return null;
  },
  is_admin: function(req, res) {
    return (req.session.user != null &&
      req.session.user.is_admin === true)
  }
});

// Routes

app.get('/', routes.index);
app.get('/login', routes.login);
app.post('/login', routes.login_post);
app.get('/logout', routes.logout);
app.get('/reg', routes.reg);
app.post('/reg', routes.reg_post);
app.get('/change_passwd', routes.change_passwd);
app.post('/change_passwd', routes.change_passwd_post);

app.get('/game_list', routes.game_list);
app.get('/game/:game_name', routes.game);
app.post('/game/:game_name', routes.game_post);
app.get('/arena/replay/:game_name/:match_id', routes.arena_replay);
app.get('/arena/hvc/:game_name/:submit_id', routes.arena_hvc);
app.post('/submit/:game_name', routes.submit_post);
app.get('/submit_list/:game_name/:user_id', routes.submit_list_adv);
app.get('/view_code/:submit_id', routes.view_code);
app.get('/match_list/:game_name/:user_id', routes.match_list_by_user);
app.get('/ranklist/:game_name', routes.ranklist);

app.get('/rejudge/:match_id', routes.rejudge);
app.get('/user/:user_id', routes.show_user);
app.get('/edit', routes.edit);
app.post('/edit', routes.edit_post);
app.get('/faq', routes.faq);

if (!module.parent) {
  app.listen(3000, function(){
    console.log("Express server listening on port %d in %s mode",
      app.address().port, app.settings.env);
  });
}

var child_process = require('child_process');
// child_process.fork(__dirname + '/compiler.js',[],{env: process.env});
// child_process.fork(__dirname + '/scheduler.js',[],{env: process.env});

io.sockets.on('connection', function(socket) {
  var hvc_match;
  var game_name;
  var hvc_match_info = {'ip': socket.handshake.address};
  socket.on('req_steps', function(data) {
    db.matches.findOne({'_id': ObjectId(data.match_id)}, function(err, match) {
      if (err) {
        console.log('Fetch Steps failed, err:' + err);
        return;
      }
      if (!match) {
        console.log('Fetch Steps. Match is null.');
        return;
      }
      var resp = {steps : match.trans};
      // console.log('%j', resp);
      socket.emit('res_steps', resp);
    });
  });
  socket.on('req_hvc', function(data) {
    console.log('receive req_hvc');
    db.submits.findOne({'_id': ObjectId(data.submit_id)},
      function(err, submit) {
        if (err || !submit) {
          console.log('Hvc request failed.');
          return;
        }
        game_name = submit.game_name;
        // start hvc process
        hvc_match = child_process.spawn(
          waiconst.MATCH_PATH + 'hvc_match.exe',
           [waiconst.JUDGE_PATH + submit.game_name + '_judge.exe',
            waiconst.USER_EXE_PATH + submit._id + '.exe']);
        console.log('spawn hvc match: pid: ' + hvc_match.pid);
        // hvc_match_info is just for archive, we needn't show
        // it to users, so the format is in a little mass.
        hvc_match_info.game_name = submit.game_name;
        hvc_match_info.submit_id = submit._id;
        hvc_match_info.status = 1;
        hvc_match_info.trans = [];
        hvc_match_info.start_time = new Date();
      });
  });
  socket.on('put_chess', function(data) {
    if (!hvc_match) return;
    // TODO: this is ugly, how to do it better?
    if (game_name === 'xiangqi' || game_name === 'chess') {
      console.log('pid: ' + hvc_match.pid + ' recv put chess: x1:' + data.x1 + " y1:" + data.y1 + " x2:" + data.x2 + " y2:" + data.y2);
      var str = data.x1 + " " + data.y1 + " " + data.x2 + " " + data.y2;
      hvc_match.stdin.write(str + "\n");
      if (data.pro_type) {
        hvc_match.stdin.write(data.pro_type + "\n");
        str += " " + data.pro_type;
      }
      hvc_match_info.trans.push(str);
    } else {
      console.log('pid: ' + hvc_match.pid + ' recv put chess: x:' + data.x + " y:" + data.y);
      hvc_match.stdin.write(data.x + " " + data.y + "\n");
      hvc_match_info.trans.push(data.x + " " + data.y);
    }
    hvc_match.stdout.once('data', function(data) {
      console.log("computer data: {" + data + "}");
      var str_list = data.toString().split('\n');
      for (var str_list_idx = 0 ; 
          str_list_idx < str_list.length ; ++str_list_idx) {
        if (str_list[str_list_idx].length === 0) continue;
        hvc_match_info.trans.push(str_list[str_list_idx]);
        var tmp = str_list[str_list_idx].split(' ');
        if (tmp.length === 0) continue;
        if (tmp[0] === ':') {
          resp = {'is_over': true, 
            'winner': parseInt(tmp[1]),
            'res_str': tmp[2].replace(/_/g, ' '),
            'reason': tmp[3].replace(/_/g,' ')};
          socket.emit('game_over', resp);
          hvc_match_info.status = 2;
          db.hvc_matches.save(hvc_match_info);
        } else if (tmp[0] === '*') {
          resp = {'invalid_step': true};
          socket.emit('put_response', resp);
        } else {
          if (game_name === 'xiangqi' || game_name === 'chess') {
            resp = {'is_over': false,
              'x1': parseInt(tmp[0]),
              'y1': parseInt(tmp[1]),
              'x2': parseInt(tmp[2]),
              'y2': parseInt(tmp[3])};
            if (tmp.length > 4) resp.pro_type = parseInt(tmp[4]);
          } else {
            resp = {'is_over': false,
              'x': parseInt(tmp[0]),
              'y': parseInt(tmp[1])};
          }
          socket.emit('put_response', resp);
        }
      }
    });
  });
  socket.on('disconnect', function() {
    if (hvc_match_info.status !== 2) {
      db.hvc_matches.save(hvc_match_info);
    }
    console.log('user disconnected');
    if (hvc_match) {
      console.log('try to kill pid:' + hvc_match.pid);
      hvc_match.kill('SIGKILL');
    }
  });
});
