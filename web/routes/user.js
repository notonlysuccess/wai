var db = require('../models/db');
var crypto = require('crypto');
var ObjectId = require('mongoose').Types.ObjectId;

exports.login = function(req, res) {
    res.render('login', { title: 'WAI : Login'});
};

exports.login_post = function(req, res) {
  var md5 = crypto.createHash('md5');
  var passwd = md5.update(req.body['passwd']).digest('base64');
  db.users.findOne({email: req.body['email']}, function(err, user) {
    if (err) {
      req.flash('error', err);
      return res.redirect('/login');
    }
    if (!user || user.passwd != passwd) {
      req.flash('error', 'Email dose not exist, or password error.');
      return res.redirect('/login');
    }
    req.session.user = user;
    req.flash('success', 'Login successfully.');
    return res.redirect('/');
  });
};

exports.logout = function(req, res) {
  req.session.user = null;
  res.redirect('/');
};

exports.reg = function(req, res) {
    res.render('reg', { title: 'WAI : Sign Up'});
};
exports.reg_post = function(req, res) {
    if (req.body['passwd'] != req.body['passwd2']) {
        req.flash('error', 'The two passwords does not fit.');
        return res.redirect('/reg');
    }
    var md5 = crypto.createHash('md5');
    var passwd = md5.update(req.body['passwd']).digest('base64');
    db.users.findOne({email: req.body['email']}, function(err, user) {
      if (user) {
        err = 'Email already exists.';
      }
      if (err) {
        req.flash('error', err);
        return res.redirect('/reg');
      }
      var newUser = {
        'email': req.body['email'],
        'passwd': passwd,
        'nick': req.body['nick'],
      };
      db.users.insert(newUser, {safe: true}, function(err, result) {
        if (err) {
          req.flash('error', err);
          return res.redirect('/reg');
        }
        req.session.user = newUser;
        req.flash('success', 'Sign up successfully.');
        return res.redirect('/');
      });
    });
};

exports.change_passwd = function(req, res) {
  if (!req.session.user) {
    req.flash('error', 'You are not login.');
    return res.redirect('back');
  }
  res.render('change_passwd', {title: 'WAI : Change Password'});
}

exports.change_passwd_post = function(req, res) {
  if (!req.session.user) {
    req.flash('error', 'You are not login.');
    return res.redirect('back');
  }
  var md5 = crypto.createHash('md5');
  var oldpasswd = md5.update(req.body['oldpasswd']).digest('base64');
  if (oldpasswd !== req.session.user.passwd) {
    req.flash('error', 'Old password error.');
    return res.redirect('back');
  }
  if (req.body['newpasswd'] !== req.body['repeatpasswd']) {
    req.flash('error', 'New password and repeated password are different.');
    return res.redirect('back');
  }
  var newpasswd = crypto.createHash('md5')
    .update(req.body['newpasswd']).digest('base64');
  db.users.update({email: req.session.user.email},
    {$set: {passwd: newpasswd}}, {safe: true}, function(err) {
      if (err) {
        console.log('update set failed. err:' + err);
        return;
      }
      req.flash('success', 'Change password successfully.');
      return res.redirect('/');
    });
}

exports.show_user = function(req, res) {
  db.users.findOne({_id: ObjectId(req.params.user_id)},
    function(err, user) {
      if (err || !user) {
        req.flash('error', 'No such user.');
        return res.redirect('back');
      }
      console.log('user: %j', user);
      res.render('user', {title: 'WAI : User Profile',
        user_profile : user});
    });
}

