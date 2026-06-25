const dmService = require('../services/dmService');
const geminiService = require('../services/gemini/geminiService');

// In-memory rate limiting tracker keyed by user id: { uid: { count, resetTime } }
const rateLimitStore = {};

function checkRateLimit(key) {
  const now = Date.now();
  const windowTime = 60 * 60 * 1000; // 1 hour
  const maxRequests = 10;

  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { count: 1, resetTime: now + windowTime };
    return { allowed: true };
  }

  const record = rateLimitStore[key];

  // Reset if window has passed
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowTime;
    return { allowed: true };
  }

  // Check if over limit
  if (record.count >= maxRequests) {
    return { allowed: false, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true };
}

exports.getSyncKey = async (req, res) => {
  try {
    const syncKey = await dmService.getOrCreateSyncKey(req.user.uid);
    return res.status(200).json({ success: true, syncKey });
  } catch (error) {
    console.error('Error generating sync key:', error);
    res.status(500).json({ success: false, error: 'Failed to generate sync key' });
  }
};

exports.getConnections = async (req, res) => {
  try {
    const firebaseData = await dmService.getConnectionsForUser(req.user.uid);
    return res.status(200).json({
      success: true,
      source: 'firebase',
      totalAnalyzed: firebaseData.totalAnalyzed || 0,
      companiesFound: firebaseData.companiesFound || 0,
      data: firebaseData.data
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve connections' });
  }
};

exports.uploadConnections = async (req, res) => {
  try {
    // Rely on multer to provide req.file
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No CSV file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf8');
    
    // Process CSV
    const result = await dmService.processConnectionsCsv(csvContent);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const contacts = (result.data || []).flatMap(group => group.contacts || []);
    await dmService.saveConnectionsForUser(req.user.uid, contacts);

    return res.status(200).json(result);

  } catch (error) {
    console.error('Error processing CSV:', error);
    res.status(500).json({ success: false, error: 'Internal server error while processing CSV' });
  }
};

exports.importConnections = async (req, res) => {
  try {
    const { connectionsBatch, syncKey } = req.body;
    console.log(`[Extension] Received batch payload of ${connectionsBatch ? connectionsBatch.length : 0} connections.`);
    
    if (!connectionsBatch || !Array.isArray(connectionsBatch)) {
      return res.status(400).json({ success: false, error: 'Invalid JSON payload. Expected { connectionsBatch: [] }' });
    }
    
    if (!syncKey) {
       return res.status(401).json({ success: false, error: 'Unauthorized: No JobApply Sync Key provided.' });
    }

    const { hrContactsCount, message } = await dmService.processRawConnectionsToFirebase(connectionsBatch, syncKey);
    return res.status(200).json({ success: true, message, parsedHRCount: hrContactsCount });

  } catch (error) {
    console.error('Error importing connections via Extension:', error);
    res.status(500).json({ success: false, error: 'Internal server error while importing connections' });
  }
};

exports.generateMessage = async (req, res) => {
  try {
    // 1. Rate Limiting Check — scoped per authenticated user so users don't
    // share a quota when behind the same IP/proxy.
    const rateLimitKey = req.user?.uid || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        success: false, 
        error: 'You have reached the hourly message generation limit. Please try again later.' 
      });
    }

    // 2. Validate Parameters
    const { hrName, companyName, candidateName, targetRole, candidateSkills, appliedJobTitle } = req.body;

    if (!hrName || !companyName || !candidateName || !targetRole) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required message generation parameters: hrName, companyName, candidateName, and targetRole are required.' 
      });
    }

    // 3. Generate Message via AI
    const message = await geminiService.generateLinkedInDM({
      hrName, 
      companyName, 
      candidateName, 
      targetRole, 
      candidateSkills, 
      appliedJobTitle
    });

    res.status(200).json({ success: true, message });

  } catch (error) {
    console.error('Error generating AI message:', error);
    res.status(500).json({ success: false, error: 'Failed to generate message' });
  }
};
