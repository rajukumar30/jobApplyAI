const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const base64 = fs.readFileSync('resume_base64.txt', 'utf8').replace(/\n/g, '');
const decoded = Buffer.from(base64, 'base64').toString('utf8');

// The base64 file had a typo at line 10: ">\geometry..."
const fixed = decoded.replace('>\geometry', '\geometry');

fs.writeFileSync('resume.tex', fixed);

const urlEncoded = encodeURIComponent(fixed);

const req = https.get(`https://latexonline.cc/compile?text=${urlEncoded}`, (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed to compile LaTeX, status:', res.statusCode);
    res.on('data', d => process.stdout.write(d));
    return;
  }
  
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', async () => {
    const pdfBuffer = Buffer.concat(chunks);
    fs.writeFileSync('Nikita_Sharma_Resume.pdf', pdfBuffer);
    console.log('Downloaded PDF successfully. Uploading to Supabase...');
    
    try {
      const fileName = `Nikita_Sharma_DataAnalyst_${Date.now()}.pdf`;
      const { data, error } = await supabase.storage
        .from('tailored-resumes')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });
        
      if (error) {
        console.error('Supabase upload error:', error);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('tailored-resumes')
          .getPublicUrl(fileName);
        
        console.log('\nUpload successful! Public URL:');
        console.log(publicUrlData.publicUrl);
      }
    } catch (err) {
      console.error('Exception during upload:', err);
    }
  });
});

req.on('error', err => console.error('Request error:', err));
