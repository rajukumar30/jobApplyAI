const https = require('https');

const latex = `\documentclass{article}
\begin{document}
Hello World!
\end{document}`;

const data = JSON.stringify({
  compiler: 'pdflatex',
  resources: [{ main: true, name: 'main.tex', content: latex }]
});

const req = https.request({
  hostname: 'latex.ytotech.com',
  port: 443,
  path: '/build',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  console.log(res.statusCode);
  if (res.statusCode !== 200) {
    res.on('data', d => process.stdout.write(d));
  } else {
    console.log('Success, headers:', res.headers);
  }
});
req.on('error', console.error);
req.write(data);
req.end();
