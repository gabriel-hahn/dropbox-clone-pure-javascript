var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var fs = require('fs');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.delete('/file', (req, res) => {
  let form = new formidable.IncomingForm({
    uploadDir: './upload',
    keepExtensions: true
  });

  form.parse(req, (error, fields, files) => {
    let path = './' + fields.path;
    if (fs.existsSync(path)) {
      fs.unlink(path, err => {
        if (err) {
          res.status(400).json({ err });
        }
        else {
          res.json({ fields });
        }
      });
    }
    res.json({ fields });
  });
});

router.post('/upload', (req, res) => {
  let form = new formidable.IncomingForm({
    uploadDir: './upload',
    keepExtensions: true
  });

  form.parse(req, (error, fields, files) => {
    res.json({ files });
  });
});

module.exports = router;
