const https = require('https');
let template = `\documentclass{article}\n\begin{document}\n\textbf{A \& B}\n\end{document}`;
// split and join to bypass regex syntax issues
let escaped = template.split('\').join('\\');

const text = encodeURIComponent(escaped);
https.get(`https://latexonline.cc/compile?text=${text}`, (res) => {
  if (res.statusCode === 200) {
    console.log('Success! Escaped twice!');
  } else {
    res.on('data', d => process.stdout.write(d));
  }
});
