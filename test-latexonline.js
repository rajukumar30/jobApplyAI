const https = require('https');
const fs = require('fs');

const latex = `\documentclass{article}
\begin{document}
Hello World! Test POST
\end{document}`;

const req = https.request({
  hostname: 'latexonline.cc',
  port: 443,
  path: '/compile',
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain'
  }
}, (res) => {
  console.log(res.statusCode);
  if (res.statusCode === 200) {
    const file = fs.createWriteStream('test-post.pdf');
    res.pipe(file);
    file.on('finish', () => console.log('Downloaded POST'));
  } else {
    res.on('data', d => process.stdout.write(d));
  }
});
req.write(latex);
req.end();
