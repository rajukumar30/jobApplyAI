const fs = require('fs');
const https = require('https');

const latex = `\documentclass{article}
\begin{document}
Hello World!
\end{document}`;

const req = https.request({
  hostname: 'texlive.net',
  port: 443,
  path: '/cgi-bin/latexcgi',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=boundary123'
  }
}, (res) => {
  console.log(res.statusCode);
  res.on('data', d => process.stdout.write(d));
});

req.write('--boundary123\r\n');
req.write('Content-Disposition: form-data; name="filecontents"; filename="doc.tex"\r\n\r\n');
req.write(latex + '\r\n');
req.write('--boundary123\r\n');
req.write('Content-Disposition: form-data; name="filename"\r\n\r\n');
req.write('doc.tex\r\n');
req.write('--boundary123\r\n');
req.write('Content-Disposition: form-data; name="engine"\r\n\r\n');
req.write('pdflatex\r\n');
req.write('--boundary123\r\n');
req.write('Content-Disposition: form-data; name="return"\r\n\r\n');
req.write('pdfjs\r\n');
req.write('--boundary123--\r\n');
req.end();
