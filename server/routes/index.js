var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('index', { title: 'Book Collection Manager' });
});

module.exports = router;
