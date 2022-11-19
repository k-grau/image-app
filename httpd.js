const http = require('http');
const express = require('express');
const app = express();
const path = require('path');
const mustacheExpress = require('mustache-express');
const server = http.createServer(app);
const formidable = require('formidable');
const fs = require('fs').promises;
const gcpService = require( "./service/gcp" );
const imageDir = path.resolve("./public/img")
const port = process.env.PORT || 8080;


const mimeTypes = {
  '.ico': 'image/x-icon',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword'
};


const setError = (errorDetails, statusCode) => {

  let error = [
                {status: 204, message: 'No content.'},
                {status: 400, message: 'Bad request.'},
                {status: 404, message: 'Resource not found.'},
                {status: 413, message: 'Request content is larger than the limit.'},
                {status: 414, message: 'Request-uri too long.'},
                {status: 500, message: 'Internal server error.'}
              ].find(err => err.status === statusCode);
  
  if(error === undefined) {
    error = {status: 500, message: 'Internal server error.'}
  }  
  error.message = (errorDetails) ? error.message + ' ' + errorDetails : error.message;
  error.message = error.status + ': ' + error.message;
  return error;
};

const sanitizeUrl = (req, res, next) => {
  req.url = path.normalize(decodeURIComponent(req.url));
  
  if (req.url.match(/\.\.\//g) !== null) {
    throw (setError('', 400));
  }
  next();
};


const getTopLabels = (labels) => {
  const topLabels = [];
  console.log('Labels:');
  labels.forEach(label => console.log(label));

  for (let i = 0; i < 5; i++) {
    if (!labels[i]) {
        { break; }
    }
    topLabels.push(labels[i].description)
  }
  topLabels.forEach(topLabel => console.log(topLabel));
  return topLabels;

}


const parseLabels = (labels) => {
  const parsedLabels = [];
 
  labels.forEach(label => {
    const parsedLabel = { label: label.description, score: label.score};
    parsedLabels.push(parsedLabel);
  });

  parsedLabels.forEach(label => console.log(label));
  return parsedLabels;
}


const clearImageDir = async (fileToKeep) => {
  for (const file of await fs.readdir(imageDir)) {
    if(file !== fileToKeep && file !== 'placeholder-img.jpg') {
      await fs.unlink(path.join(imageDir, '/' + file));
    }
  }
}

const currentImage = {path: "", labels: {labels : []}, topLabels: []};

app.set('views', __dirname + '/views');

app.set('view engine', 'mustache');

app.engine('mustache', mustacheExpress());

app.use(express.json());

app.use(express.urlencoded({extended: true}));

app.use(sanitizeUrl);



app.get('/', async (req, res, next) => {
  let filePath = currentImage.path ? currentImage.path.split('/').slice(-2).join('/') : "img/placeholder-img.jpg";
  let fileName = currentImage.path ? currentImage.path.split('/').pop() : "";
  let labels = currentImage.labels;
  let topLabels = currentImage.topLabels ? currentImage.topLabels.join(', ') : "";

  currentImage.path = '';
  currentImage.labels = {labels: []};
  currentImage.fileName = "";
  currentImage.topLabels = "";
  clearImageDir(fileName);

  res.setHeader('Content-Type', mimeTypes['.html']);
  res.status(200).render('main', {
    fileName: fileName,
    filePath: filePath,
    topLabels: topLabels,
    labels: labels
  });
});



app.post('/image', (req, res, next) => {
  const form = new formidable.IncomingForm();
  form.multiples = true;
  let labels;
  let parsedLabels;

  form.parse(req, async (err, fields, files) => {
    if(files.image.originalFilename === undefined || files.image.originalFilename === '') {
      return res.redirect(302, "/");
    }
    
    const rawData = await fs.readFile(files.image.filepath, err => {
      if(err) {
        console.log(err);
        err.status = 500;
        next(setError, err, err.status)
      }
    });

    const filePath = imageDir + '/' + files.image.originalFilename;
    
    await fs.writeFile(filePath, rawData, err => {
      if(err) {
        console.log(err);
        err.status = 500;
        next(setError, err, err.status)
      }
    });

    labels = await gcpService.analyzeImage(filePath);
    parsedLabels = parseLabels(labels);
    await gcpService.uploadToBucket(filePath, parsedLabels);
    
    currentImage.path = filePath;
    currentImage.labels = parsedLabels;
    currentImage.topLabels = getTopLabels(labels);
   
    res.setHeader('Content-Type', mimeTypes['.json']);
    res.redirect(302, "/")
  })
});


app.get('/error', (req, res) => {
  if(req.query.message && req.query.status) {
    return res.status(req.query.status).send(req.query.message);
  }
  res.redirect(302, '/'); 
});


app.use(express.static('public'));


app.use((error, req, res, next) => {
  error.status = error.status || 500;
  res.status(error.status).send(error.message);
});


server.listen(port);



