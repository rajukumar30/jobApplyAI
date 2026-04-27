function scoreFakeJob(data) {
  let score = 50;
  const signals = [];
  const warnings = [];

  // Format inputs securely
  const companyNameRaw = data.company_name || "";
  const companyNameClean = companyNameRaw.toLowerCase().replace(/[^a-z0-9]/g, '');

  console.log(`\n🛡️ --- FAKE JOB DETECTION ---`);
  console.log(`Company Target: ${companyNameRaw || 'Unknown'}`);
  console.log(`Extracted Gemini Output:`, JSON.stringify(data, null, 2));

  // RULE 1: Recruiter Authenticity
  if (data.recruiter_current_company && companyNameRaw) {
    const rc = data.recruiter_current_company.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Make sure we have a valid word to check against
    if (companyNameClean.length > 2 && rc.includes(companyNameClean) || companyNameClean.includes(rc)) {
      score += 25;
      signals.push("Recruiter works at company");
    } else if (data.recruiter_previous_company) {
      const rp = data.recruiter_previous_company.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (companyNameClean.length > 2 && (rp.includes(companyNameClean) || companyNameClean.includes(rp))) {
        score += 10;
        signals.push("Recruiter previously worked at company");
      } else {
        score -= 20;
        warnings.push("Recruiter not associated with company");
      }
    } else {
      score -= 20;
      warnings.push("Recruiter not associated with company");
    }
  }

  // RULE 2: Company Page
  if (data.company_page_exists === true || data.company_page_exists === "true") {
    score += 15;
    signals.push("Company LinkedIn page verified");
  } else if (data.company_page_exists === false || data.company_page_exists === "false") {
    score -= 25;
    warnings.push("Company page missing");
  }

  // RULE 3: Followers
  if (data.company_followers !== null && typeof data.company_followers === 'number') {
    if (data.company_followers > 100000) score += 15;
    else if (data.company_followers > 10000) score += 10;
    else if (data.company_followers > 1000) score += 5;
    else {
      score -= 10;
      warnings.push("Very low company followers");
    }
  }

  // RULE 4: Employees
  if (data.company_employee_count !== null && typeof data.company_employee_count === 'number') {
    if (data.company_employee_count > 1000) score += 15;
    else if (data.company_employee_count > 100) score += 10;
    else if (data.company_employee_count > 10) score += 5;
    else {
      score -= 10;
      warnings.push("Very small company workforce");
    }
  }

  // RULE 5: Easy Apply
  if (data.apply_methods?.easy_apply === true) {
    score += 15;
    signals.push("LinkedIn Easy Apply enabled");
  }

  // RULE 6: Email 
  if (data.apply_methods?.email) {
    const email = data.apply_methods.email.toLowerCase();
    const domain = email.split('@')[1];
    
    if (domain) {
      const publicDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me", "aol.com"];
      const domainSlug = domain.split('.')[0];

      if (publicDomains.includes(domain)) {
        score -= 20;
        warnings.push("Public email domain used for hiring");
      } else if (companyNameClean.length > 2 && (domainSlug.includes(companyNameClean) || companyNameClean.includes(domainSlug))) {
        score += 10;
        signals.push("Official company email");
      } else {
        score -= 10;
        warnings.push(`Unknown recruiter email domain (@${domain})`);
      }
    }
  }

  // RULE 7: Phone/Messaging
  if (data.apply_methods?.phone) {
    score -= 10;
    warnings.push("Phone number application detected");
  }

  const textLower = (data.post_text || "").toLowerCase();
  if (textLower.includes("whatsapp") || textLower.includes("telegram")) {
    score -= 15;
    warnings.push("Messaging platform used for hiring");
  }

  // RULE 8: Links
  if (data.apply_methods?.links && data.apply_methods.links.length > 0) {
    const atsPlatforms = ["workday", "greenhouse", "lever", "smartrecruiters", "bamboohr", "myworkdayjobs", "icims"];
    const shorteners = ["bit.ly", "tinyurl", "t.co", "ow.ly"];
    
    data.apply_methods.links.forEach((link, idx) => {
      // only evaluate up to 3 links to avoid spamming the score
      if (idx > 2) return; 

      const l = link.toLowerCase();
      let matched = false;

      if (companyNameClean.length > 2 && l.includes(companyNameClean)) {
        score += 15;
        signals.push(`Official company career link detected`);
        matched = true;
      }

      if (!matched && atsPlatforms.some(ats => l.includes(ats))) {
        score += 10;
        signals.push(`Trusted ATS hiring platform detected`);
        matched = true;
      }
      
      if (!matched && shorteners.some(sh => l.includes(sh))) {
        score -= 10;
        warnings.push(`Shortened job application link detected`);
      }
    });
  }

  // RULE 9: Suspicious Language
  const scamKeywords = [
    "registration fee", "training fee", "earn money fast", 
    "no interview", "urgent hiring whatsapp", "guaranteed job", "pay to apply",
    "deposit required"
  ];
  const foundScam = scamKeywords.filter(k => textLower.includes(k));
  if (foundScam.length > 0) {
    score -= 20;
    warnings.push(`Scam-like language detected ("${foundScam[0]}")`);
  }

  // Normalize limit
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  // Risk Classification
  let risk_level = "";
  if (score >= 86) risk_level = "Legit";
  else if (score >= 70) risk_level = "Likely Legit";
  else if (score >= 40) risk_level = "Suspicious";
  else risk_level = "High Risk / Likely Fake";

  return {
    authenticity_score: score,
    risk_level,
    signals_detected: [...new Set(signals)],
    warnings: [...new Set(warnings)]
  };
}

module.exports = { scoreFakeJob };
